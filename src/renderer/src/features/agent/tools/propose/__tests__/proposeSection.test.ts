import { beforeEach, describe, expect, it } from 'vitest';
import type { ResumeData } from '@shared/types/resume';
import { useProposalStore } from '@/stores/proposalStore';
import { getResumeSnapshot, useResumeStore } from '@/stores/resumeStore';
import {
  acceptProposals,
  confirmProposalFact,
  discardEmptySections,
  discardRunProposals,
} from '../../../../suggestions/proposals/proposalActions';
import { makeResumeWithLines } from '../../../../suggestions/proposals/__tests__/proposalFixtures';
import { readActiveVersion } from '../../../../suggestions/proposals/proposalVersions';
import { findUnconfirmedFacts } from '../../../../suggestions/proposals/reviewedChange';
import { buildWorkingCopy } from '../../../../suggestions/proposals/workingCopy';
import { countSuggestions } from '../../../../suggestions/suggestionState';
import { runAgentTool } from '../../runAgentTool';
import { createAgentToolRun } from '../../tool-run/agentToolRun';

/*
 * The fixture resume holds Experience (s1, entries e1 and e2, bullets b1 to b4), Summary
 * (s2, line l1) and Skills (s3, lines l2 and l3). The first new section is s4.
 */

const openDraft = (doc: ResumeData) =>
  useResumeStore.getState().loadDraft({ templateId: 't1', doc, rev: 3 });

const stagedSuggestions = () => useProposalStore.getState().byTemplate.t1 ?? [];
/** The active version of each staged suggestion. In these tests each one has only one version. */
const stagedVersions = () => stagedSuggestions().map(readActiveVersion);
const stagedChanges = () => stagedVersions().map((version) => version.change);
const stagedKinds = () => stagedChanges().map((change) => change.kind);

const readWorkingCopy = () => buildWorkingCopy(getResumeSnapshot(), stagedSuggestions());

/** The working copy's sections in page order, as "label: item, item". */
const readSections = () =>
  [...readWorkingCopy().sections]
    .sort((a, b) => a.order - b.order)
    .map((section) => {
      const items = section.items.map((item) => item.text ?? item.title ?? '');
      return `${section.label}: ${items.join(' | ')}`;
    });

let run = createAgentToolRun('Add a section');

const callTool = (name: string, args: unknown = {}) => runAgentTool(run, name, args);

beforeEach(async () => {
  useProposalStore.setState({ byTemplate: {} });
  openDraft(makeResumeWithLines());
  run = createAgentToolRun('Add a section');
  await callTool('read_document');
});

describe('propose_section', () => {
  it('makes an empty preset section last, and says how to fill it', async () => {
    const result = await callTool('propose_section', { kind: 'languages' });
    expect(result.content).toBe(
      'a new section, Languages: suggested. It is s4, and it is empty: add its lines with propose_add (into s4). Checks: none.'
    );
    expect(stagedSuggestions()[0].source).toBe('section');
    expect(stagedChanges()[0]).toEqual({
      kind: 'section',
      afterSectionId: 's3',
      section: { kind: 'languages', layout: 'lines', label: 'Languages' },
      contents: null,
    });
  });

  it('tells the model to add a first entry to a preset that holds entries', async () => {
    const result = await callTool('propose_section', { kind: 'projects' });
    expect(result.content).toContain(
      'it is empty: add its first entry with propose_entry (sectionId s4).'
    );
  });

  it('tells the model a custom section takes an entry or lines', async () => {
    const result = await callTool('propose_section', { kind: 'custom', label: 'Talks' });
    expect(result.content).toContain(
      'it is empty: add its first entry with propose_entry (sectionId s4), or its lines with propose_add (into s4).'
    );
  });

  it('uses the heading given for a preset', async () => {
    await callTool('propose_section', { kind: 'skills', label: 'Tools' });
    expect(stagedChanges()[0]).toMatchObject({
      section: { kind: 'skills', layout: 'lines', label: 'Tools' },
    });
  });

  it('refuses a custom section with no heading', async () => {
    const result = await callTool('propose_section', { kind: 'custom' });
    expect(result).toMatchObject({
      isError: true,
      content: 'A custom section needs label, its heading.',
    });
    expect(stagedSuggestions()).toEqual([]);
  });

  it('takes a custom section named as a preset as that preset, and says so', async () => {
    const result = await callTool('propose_section', { kind: 'custom', label: 'Projects' });
    expect(result.content).toContain('Took custom "Projects" as the projects preset.');
    expect(stagedChanges()[0]).toMatchObject({
      section: { kind: 'projects', layout: 'entries', label: 'Projects' },
    });
  });

  it('refuses a heading the resume already has, naming the section and the tool that adds to it', async () => {
    const skills = await callTool('propose_section', { kind: 'skills' });
    expect(skills).toMatchObject({
      isError: true,
      content: 'There is already a section named Skills, s3. propose_add (into s3) adds to it.',
    });
    const experience = await callTool('propose_section', { kind: 'custom', label: 'experience' });
    expect(experience.content).toBe(
      'There is already a section named Experience, s1. propose_entry (sectionId s1) adds to it.'
    );
    expect(stagedSuggestions()).toEqual([]);
  });

  it('refuses a second Summary whatever its heading', async () => {
    const result = await callTool('propose_section', { kind: 'summary', label: 'Profile' });
    expect(result).toMatchObject({
      isError: true,
      content: 'A resume has one Summary, and s2 is it. propose_rewrite changes what it says.',
    });
  });

  it('puts a second section of a kind below the first of that kind, and names the first', async () => {
    await callTool('propose_reorder', { order: ['s3', 's1', 's2'] });
    const result = await callTool('propose_section', { kind: 'skills', label: 'Tools' });
    expect(result.content).toContain('s3, Skills, is a skills section too.');
    expect(stagedChanges().at(-1)).toMatchObject({ afterSectionId: 's3' });
  });

  it('places the section first with "start", and after a section handle', async () => {
    await callTool('propose_section', { kind: 'languages', after: 'start' });
    await callTool('propose_section', { kind: 'interests', after: 's1' });
    expect(stagedChanges()).toMatchObject([{ afterSectionId: null }, { afterSectionId: 's1' }]);
  });

  it('refuses the same section again while the first is waiting, pointing to it', async () => {
    await callTool('propose_section', { kind: 'languages' });
    const again = await callTool('propose_section', { kind: 'languages' });
    expect(again.content).toBe(
      'There is already a section named Languages, s4. propose_add (into s4) adds to it.'
    );
    expect(stagedSuggestions()).toHaveLength(1);
  });
});

describe('filling a new section', () => {
  it('puts lines into the section’s suggestion, in the places asked for', async () => {
    await callTool('propose_section', { kind: 'languages' });
    const first = await callTool('propose_add', { into: 's4', text: 'Norwegian, basic' });
    expect(first.content).toBe('a new line in s4: suggested. It is l4. Checks: none.');
    await callTool('propose_add', { into: 's4', after: 'start', text: 'Spanish, fluent' });
    await callTool('propose_add', { into: 's4', after: 'l5', text: 'German, basic' });

    expect(stagedSuggestions()).toHaveLength(1);
    expect(stagedChanges()[0]).toMatchObject({
      contents: {
        layout: 'lines',
        lines: ['Spanish, fluent', 'German, basic', 'Norwegian, basic'],
      },
    });
    expect(readSections().at(-1)).toBe(
      'Languages: Spanish, fluent | German, basic | Norwegian, basic'
    );
  });

  it('puts the first entry into the section’s suggestion, and names its handles', async () => {
    await callTool('propose_section', { kind: 'projects' });
    const result = await callTool('propose_entry', {
      sectionId: 's4',
      title: 'Tidewatch',
      bullets: ['Built a tide chart app in Kotlin'],
    });
    expect(result.content).toContain('a new entry in s4: suggested. It is e3, with bullets b5.');
    expect(stagedSuggestions()).toHaveLength(1);
    expect(stagedChanges()[0]).toMatchObject({
      contents: {
        layout: 'entries',
        entries: [{ frame: { title: 'Tidewatch' }, bullets: ['Built a tide chart app in Kotlin'] }],
      },
    });
  });

  it('puts a second entry, and a bullet in the first, into the section’s suggestion', async () => {
    await callTool('propose_section', { kind: 'projects' });
    await callTool('propose_entry', { sectionId: 's4', title: 'Tidewatch' });
    await callTool('propose_entry', { sectionId: 's4', title: 'Harbor Map', after: 'e3' });
    const bullet = await callTool('propose_add', { into: 'e3', text: 'Built it in Kotlin' });
    expect(bullet.content).toContain('a new bullet in e3: suggested. It is b5.');
    expect(stagedSuggestions()).toHaveLength(1);
    expect(stagedChanges()[0]).toMatchObject({
      contents: {
        entries: [
          { frame: { title: 'Tidewatch' }, bullets: ['Built it in Kotlin'] },
          { frame: { title: 'Harbor Map' }, bullets: [] },
        ],
      },
    });
    expect(readSections().at(-1)).toBe('Projects: Tidewatch | Harbor Map');
  });

  it('rewrites a bullet of a later entry inside the section’s suggestion', async () => {
    await callTool('propose_section', { kind: 'projects' });
    await callTool('propose_entry', { sectionId: 's4', title: 'Tidewatch' });
    await callTool('propose_entry', {
      sectionId: 's4',
      title: 'Harbor Map',
      after: 'e3',
      bullets: ['Drew the harbor map'],
    });
    await callTool('propose_rewrite', { id: 'b5', text: 'Drew the harbor map in Leaflet' });
    expect(stagedSuggestions()).toHaveLength(1);
    expect(stagedChanges()[0]).toMatchObject({
      contents: { entries: [{ bullets: [] }, { bullets: ['Drew the harbor map in Leaflet'] }] },
    });
  });

  it('tags only what a later run put into a waiting suggestion as just added', async () => {
    await callTool('propose_section', { kind: 'projects' });
    await callTool('propose_entry', { sectionId: 's4', title: 'Tidewatch' });
    expect(stagedVersions()[0].lateIds).toBeUndefined();

    run = createAgentToolRun('Add another project');
    await callTool('read_document');
    await callTool('propose_entry', { sectionId: 's4', title: 'Harbor Map', after: 'e3' });
    await callTool('propose_add', { into: 'e3', text: 'Built it in Kotlin' });
    const [section] = stagedVersions();
    const ids = section.newContentIds;
    const entryIds =
      ids?.kind === 'section' && ids.contents?.layout === 'entries' ? ids.contents.entries : [];
    expect(section.lateIds).toEqual([entryIds[1].entryId, entryIds[0].bulletIds[0]]);
  });

  it('puts a bullet into a waiting new entry alone, and makes one for a kept entry its own', async () => {
    await callTool('propose_entry', { sectionId: 's1', title: 'Volunteer Mentor' });
    await callTool('propose_add', { into: 'e3', text: 'Mentored first-time contributors' });
    expect(stagedSuggestions()).toHaveLength(1);
    expect(stagedChanges()[0]).toMatchObject({
      kind: 'entry',
      bullets: ['Mentored first-time contributors'],
    });

    const [entry] = stagedSuggestions();
    const { newContentIds } = readActiveVersion(entry);
    const entryId = newContentIds?.kind === 'entry' ? newContentIds.entry.entryId : '';
    confirmProposalFact(entry.id, { entryId, fact: 'title' }, true);
    acceptProposals([entry.id]);
    await callTool('propose_add', { into: 'e3', text: 'Ran the weekend sprints' });
    expect(stagedKinds()).toEqual(['entry', 'add']);
  });

  it('lets an empty custom section take lines', async () => {
    await callTool('propose_section', { kind: 'custom', label: 'Talks' });
    await callTool('propose_add', { into: 's4', text: 'Speaker at the Bergen Go meetup, 2024' });
    expect(stagedChanges()[0]).toMatchObject({
      section: { kind: 'custom', layout: 'lines' },
      contents: { layout: 'lines', lines: ['Speaker at the Bergen Go meetup, 2024'] },
    });
  });

  it('lets an empty custom section take an entry, which makes it hold entries', async () => {
    await callTool('propose_section', { kind: 'custom', label: 'Talks' });
    const result = await callTool('propose_entry', { sectionId: 's4', title: 'Bergen Go meetup' });
    expect(result.isError).toBe(false);
    expect(stagedChanges()[0]).toMatchObject({
      section: { kind: 'custom', layout: 'entries' },
      contents: { layout: 'entries' },
    });
    const read = await callTool('read_document');
    expect(read.content).toContain('### Bergen Go meetup (suggested, new) (e3)');
    const line = await callTool('propose_add', { into: 's4', text: 'A line' });
    expect(line.content).toContain('a new bullet in e3: suggested.');
  });

  it('still refuses an entry in a lines section the user has', async () => {
    const result = await callTool('propose_entry', { sectionId: 's3', title: 'Go' });
    expect(result.isError).toBe(true);
  });

  it('rewrites a line and the heading inside the section’s suggestion', async () => {
    await callTool('propose_section', { kind: 'languages' });
    await callTool('propose_add', { into: 's4', text: 'Spanish, fluent' });
    await callTool('propose_rewrite', { id: 'l4', text: 'Spanish, native' });
    await callTool('propose_rename', { sectionId: 's4', label: 'Spoken languages' });
    expect(stagedSuggestions()).toHaveLength(1);
    expect(stagedChanges()[0]).toMatchObject({
      section: { label: 'Spoken languages' },
      contents: { lines: ['Spanish, native'] },
    });
  });

  it('adds to a section the user already kept as a suggestion of its own', async () => {
    await callTool('propose_section', { kind: 'languages' });
    await callTool('propose_add', { into: 's4', text: 'Spanish, fluent' });
    acceptProposals([stagedSuggestions()[0].id]);
    await callTool('propose_add', { into: 's4', text: 'Norwegian, basic' });
    expect(stagedKinds()).toEqual(['section', 'add']);
  });

  it('adds an entry to a section the user already kept as a suggestion of its own', async () => {
    await callTool('propose_section', { kind: 'projects' });
    await callTool('propose_entry', { sectionId: 's4', title: 'Tidewatch' });
    const [section] = stagedSuggestions();
    for (const place of findUnconfirmedFacts(readActiveVersion(section))) {
      confirmProposalFact(section.id, place, true);
    }
    acceptProposals([section.id]);
    await callTool('propose_entry', { sectionId: 's4', title: 'Harbor Map', after: 'e3' });
    expect(stagedKinds()).toEqual(['section', 'entry']);
  });
});

describe('a new section that is still empty', () => {
  it('is not counted and can’t be kept', async () => {
    await callTool('propose_section', { kind: 'languages' });
    const [section] = stagedSuggestions();
    expect(countSuggestions(stagedSuggestions())).toEqual({ waiting: 0, stale: 0 });
    acceptProposals([section.id]);
    expect(stagedSuggestions()[0].status).toBe('pending');
  });

  it('is counted and can be kept once it has a line', async () => {
    await callTool('propose_section', { kind: 'languages' });
    await callTool('propose_add', { into: 's4', text: 'Spanish, fluent' });
    expect(countSuggestions(stagedSuggestions())).toEqual({ waiting: 1, stale: 0 });
    acceptProposals([stagedSuggestions()[0].id]);
    expect(stagedSuggestions()[0].status).toBe('accepted');
  });

  it('is removed when the run ends, and a filled one stays', async () => {
    await callTool('propose_section', { kind: 'languages' });
    await callTool('propose_section', { kind: 'interests' });
    await callTool('propose_add', { into: 's5', text: 'Bouldering' });
    const [languages, interests] = stagedSuggestions();
    expect(discardEmptySections([...run.stagedIds])).toEqual([languages.id]);
    expect(stagedSuggestions().map((proposal) => proposal.id)).toEqual([interests.id]);
  });

  it('goes with the rest when the run is discarded', async () => {
    await callTool('propose_section', { kind: 'languages' });
    await callTool('propose_add', { into: 's4', text: 'Spanish, fluent' });
    discardRunProposals([...run.stagedIds], [...run.suggestionsBeforeRun.values()]);
    expect(stagedSuggestions()).toEqual([]);
  });
});
