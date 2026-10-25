import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Version, VersionMeta } from '@shared/types/db';
import type { ResumeData } from '@shared/types/resume';
import {
  makeResume,
  makeResumeWithLines,
} from '../../../suggestions/proposals/__tests__/proposalFixtures';

const storedVersions = vi.hoisted(() => ({ list: [] as VersionMeta[], doc: null as unknown }));
vi.mock('@/stores/templateStore', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/stores/templateStore')>()),
  readVersionHistory: async () => storedVersions.list,
  readVersion: async (id: string) => ({
    ...storedVersions.list.find((version) => version.id === id),
    doc: storedVersions.doc,
  }),
}));

const { useResumeStore } = await import('@/stores/resumeStore');
const { useProposalStore } = await import('@/stores/proposalStore');
const { createAgentToolRun } = await import('../agentToolRun');
const { runAgentTool } = await import('../runAgentTool');

const openDraft = (doc: ResumeData, templateId = 't1', rev = 3) =>
  useResumeStore.getState().loadDraft({ templateId, doc, rev });

const stagedSuggestions = () => useProposalStore.getState().byTemplate.t1 ?? [];

/** The resume with one bullet's text changed, as an edit since the read would leave it. */
function withBulletText(bulletId: string, text: string): ResumeData {
  const doc = makeResume();
  for (const entry of doc.sections[0].items) {
    for (const bullet of entry.bullets) if (bullet.id === bulletId) bullet.text = text;
  }
  return doc;
}

let run = createAgentToolRun('Tighten my bullets');

beforeEach(() => {
  useProposalStore.setState({ byTemplate: {} });
  openDraft(makeResume());
  run = createAgentToolRun('Tighten my bullets');
});

const callTool = (name: string, args: unknown = {}) => runAgentTool(run, name, args);
const readTheResume = () => callTool('read_document');

describe('read_document', () => {
  it('gives the draft with handles, and where the draft stood', async () => {
    const result = await readTheResume();
    expect(result.isError).toBe(false);
    expect(result.draft).toEqual({ templateId: 't1', rev: 3 });
    expect(result.content).toContain('## Experience (s1)');
    expect(result.content).toContain(
      '### Backend Engineer, Harbor Freight Labs · 2021 – 2024 (e1)'
    );
    expect(result.content).toContain('- b2: Reduced p99 latency from 18% to 3% of requests');
    expect(result.content).toContain('### Intern, Lantern Maps (e2)');
  });

  it("keeps a bullet's handle across reads, whatever moves", async () => {
    await readTheResume();
    const doc = makeResume();
    doc.sections[0].items[0].bullets.reverse();
    openDraft(doc, 't1', 4);
    expect((await readTheResume()).content).toMatch(/- b3: Wrote[^\n]*\n- b2: Reduced/);
  });

  it('gives lines sections and their lines handles, and marks what is hidden', async () => {
    const doc = makeResumeWithLines();
    doc.sections[0].items[0].bullets[0].selected = false;
    doc.sections[2].items[1].selected = false;
    openDraft(doc);
    const { content } = await readTheResume();
    expect(content).toContain('- b1 (hidden): Assisted');
    expect(content).toContain('## Summary (s2)\n- l1: Backend engineer for six years.');
    expect(content).toContain('## Skills (s3)\n- l2: Go, Python, Postgres\n- l3 (hidden): Docker');
  });

  it('says so when no resume is open', async () => {
    useResumeStore.getState().loadDraft(null);
    expect(await readTheResume()).toMatchObject({ isError: true, draft: null });
  });
});

describe('the propose tools', () => {
  it('refuse until the resume is read', async () => {
    const result = await callTool('propose_rewrite', { id: 'b1', text: 'Led billing' });
    expect(result).toMatchObject({
      isError: true,
      content: expect.stringContaining('read_document'),
    });
    expect(stagedSuggestions()).toEqual([]);
  });

  it('stage a rewrite against the text the run read', async () => {
    await readTheResume();
    const result = await callTool('propose_rewrite', {
      id: 'b1',
      text: 'Helped migrate billing to Postgres',
      reason: 'Shorter',
    });
    expect(result).toMatchObject({ isError: false, content: expect.stringContaining('b1') });
    expect(stagedSuggestions()[0]).toMatchObject({
      source: 'rewrite',
      reason: 'Shorter',
      requestText: 'Tighten my bullets',
      change: {
        kind: 'rewrite',
        place: { bulletId: 'b1' },
        before: 'Assisted in migrating billing to Postgres',
      },
    });
  });

  it('refuse a bullet the user edited since the read, with the fix', async () => {
    await readTheResume();
    openDraft(withBulletText('b1', 'Migrated billing to Postgres'), 't1', 4);
    const result = await callTool('propose_rewrite', { id: 'b1', text: 'Led billing' });
    expect(result).toMatchObject({
      isError: true,
      content: expect.stringContaining('Read it again'),
    });
  });

  it('refuse when another resume is open than the one read', async () => {
    await readTheResume();
    openDraft(makeResume(), 't2');
    expect((await callTool('propose_select', { id: 'b1', show: false })).content).toContain(
      'Another resume is open'
    );
  });

  it('name an unknown handle', async () => {
    await readTheResume();
    const result = await callTool('propose_rewrite', { id: 'b9', text: 'x' });
    expect(result.content).toContain('No bullet "b9"');
  });

  it('need the version without a number for a {{?}} gap', async () => {
    await readTheResume();
    expect(
      (await callTool('propose_rewrite', { id: 'b3', text: 'Cut pages by {{?}}%' })).isError
    ).toBe(true);
    await callTool('propose_rewrite', {
      id: 'b3',
      text: 'Wrote the runbook that cut pages by {{?}}%',
      withoutNumber: 'Wrote the runbook for payments',
    });
    expect(stagedSuggestions()[0].change).toMatchObject({
      gap: { withoutNumber: 'Wrote the runbook for payments' },
    });
  });

  it('replace a term in every bullet holding it, one suggestion each', async () => {
    await readTheResume();
    const result = await callTool('propose_replace_everywhere', {
      find: 'for the',
      replace: 'for our',
    });
    expect(result.isError).toBe(false);
    expect(stagedSuggestions().map((proposal) => proposal.change)).toMatchObject([
      { place: { bulletId: 'b3' }, after: 'Wrote the on-call runbook for our payments team' },
      { place: { bulletId: 'b4' }, after: 'Built tile caching for our Oslo office' },
    ]);
    expect(stagedSuggestions().map((proposal) => proposal.source)).toEqual(['replace', 'replace']);
  });

  it('rename every use in a bullet, never inside a word, and say when no bullet has it', async () => {
    await readTheResume();
    await callTool('propose_replace_everywhere', { find: 'the', replace: 'our' });
    expect(stagedSuggestions().map((proposal) => proposal.change)).toMatchObject([
      { place: { bulletId: 'b3' }, after: 'Wrote our on-call runbook for our payments team' },
      { place: { bulletId: 'b4' }, after: 'Built tile caching for our Oslo office' },
    ]);
    expect(
      (await callTool('propose_replace_everywhere', { find: 'Post', replace: 'x' })).content
    ).toContain('in no bullet');
    expect(
      (await callTool('propose_replace_everywhere', { find: 'Kafka', replace: 'x' })).content
    ).toContain('in no bullet');
  });

  it('split where the second bullet starts', async () => {
    await readTheResume();
    await callTool('propose_split', { bulletId: 'b2', secondStartsWith: 'from 18%' });
    expect(stagedSuggestions()[0].change).toMatchObject({
      kind: 'split',
      at: 'Reduced p99 latency '.length,
    });
  });

  it('merge neighbours in one entry, and only those', async () => {
    await readTheResume();
    expect(
      (await callTool('propose_merge', { firstBulletId: 'b3', secondBulletId: 'b4', text: 'x' }))
        .content
    ).toContain('one entry');
    await callTool('propose_merge', {
      firstBulletId: 'b1',
      secondBulletId: 'b2',
      text: 'Moved billing to Postgres and cut p99 latency',
    });
    expect(stagedSuggestions()[0].change).toMatchObject({
      kind: 'merge',
      firstId: 'b1',
      secondId: 'b2',
    });
  });

  it("reorder entries, or an entry's bullets, finding the list from the handles", async () => {
    await readTheResume();
    await callTool('propose_reorder', { order: ['e2', 'e1'] });
    await callTool('propose_reorder', { order: '["b3","b1","b2"]' });
    expect(stagedSuggestions().map((proposal) => proposal.change)).toMatchObject([
      { kind: 'reorder', place: { unit: 'items', sectionId: 's1' }, after: ['e2', 'e1'] },
      { kind: 'reorder', place: { unit: 'bullets', entryId: 'e1' }, after: ['b3', 'b1', 'b2'] },
    ]);
  });

  it('refuse an order that mixes lists or leaves one out, with the facts', async () => {
    await readTheResume();
    expect((await callTool('propose_reorder', { order: ['e2', 'b3', 'b2', 'b1'] })).content).toBe(
      'order mixes lists: e2 is an entry in s1; b3, b2, b1 are bullets in e1. order is the handles of one list.'
    );
    expect((await callTool('propose_reorder', { order: ['b2', 'b1'] })).content).toBe(
      'That list holds b1, b2, b3; order gives b2, b1. order is every one of them, once.'
    );
    expect(stagedSuggestions()).toEqual([]);
  });

  it('hide a bullet, taking "false" as false', async () => {
    await readTheResume();
    await callTool('propose_select', { id: 'b2', show: 'false' });
    expect(stagedSuggestions()[0].change).toMatchObject({ kind: 'select', selected: false });
  });

  it('draft a new entry with only the facts given', async () => {
    await readTheResume();
    await callTool('propose_entry', {
      sectionId: 's1',
      after: 'e1',
      title: 'Volunteer',
      organization: 'Code for Portland',
      location: '',
      bullets: ['Mapped bus stops for the transit app'],
    });
    expect(stagedSuggestions()[0].change).toEqual({
      kind: 'entry',
      sectionId: 's1',
      afterEntryId: 'e1',
      frame: { title: 'Volunteer', organization: 'Code for Portland' },
      bullets: ['Mapped bus stops for the transit app'],
    });
  });

  it('place a new entry last when after is left out, and first with "start"', async () => {
    await readTheResume();
    await callTool('propose_entry', { sectionId: 's1', title: 'Volunteer' });
    await callTool('propose_entry', { sectionId: 's1', after: 'start', title: 'Founder' });
    expect(stagedSuggestions().map((proposal) => proposal.change)).toMatchObject([
      { afterEntryId: 'e2' },
      { afterEntryId: undefined },
    ]);
    expect((await callTool('propose_entry', { sectionId: 's1', after: 'e7' })).content).toBe(
      'No entry "e7". Use a entry handle from read_document, such as e1.'
    );
  });
});

describe('the propose tools, on lines, entries and sections', () => {
  beforeEach(() => openDraft(makeResumeWithLines()));

  it('rewrite a line, and point a heading to propose_rename', async () => {
    await readTheResume();
    await callTool('propose_rewrite', { id: 'l2', text: 'Go, Python, PostgreSQL' });
    expect(stagedSuggestions()[0].change).toEqual({
      kind: 'rewrite',
      place: { unit: 'line', sectionId: 's3', lineId: 'l2' },
      before: 'Go, Python, Postgres',
      after: 'Go, Python, PostgreSQL',
    });
    expect((await callTool('propose_rewrite', { id: 's2', text: 'About' })).content).toBe(
      '"s2" doesn\'t fit id. id: The bullet or line to rewrite; for a section\'s heading, use propose_rename. A bullet or line handle from the resume, such as b1 or l1.'
    );
  });

  it("rename a section's heading", async () => {
    await readTheResume();
    await callTool('propose_rename', { sectionId: 's1', label: 'Work history' });
    expect(stagedSuggestions()[0]).toMatchObject({
      source: 'rename',
      change: { kind: 'rename', sectionId: 's1', before: 'Experience', after: 'Work history' },
    });
  });

  it('hide a line, an entry or a section, with what the user sees of it', async () => {
    await readTheResume();
    for (const id of ['l3', 'e2', 's2']) await callTool('propose_select', { id, show: false });
    expect(stagedSuggestions().map((proposal) => proposal.change)).toMatchObject([
      { place: { unit: 'line', lineId: 'l3' }, before: 'Docker, Terraform' },
      { place: { unit: 'entry', entryId: 'e2' }, before: 'Intern, Lantern Maps' },
      { place: { unit: 'section', sectionId: 's2' }, before: 'Summary' },
    ]);
  });

  it("reorder the sections, or a section's lines", async () => {
    await readTheResume();
    await callTool('propose_reorder', { order: ['s3', 's1', 's2'] });
    await callTool('propose_reorder', { order: ['l3', 'l2'] });
    expect(stagedSuggestions().map((proposal) => proposal.change)).toMatchObject([
      { place: { unit: 'sections' }, before: ['s1', 's2', 's3'], after: ['s3', 's1', 's2'] },
      { place: { unit: 'items', sectionId: 's3' }, after: ['l3', 'l2'] },
    ]);
  });

  it('replace a term in lines too, never in a heading', async () => {
    await readTheResume();
    await callTool('propose_replace_everywhere', { find: 'Postgres', replace: 'PostgreSQL' });
    expect(stagedSuggestions().map((proposal) => proposal.change)).toMatchObject([
      { place: { bulletId: 'b1' }, after: 'Assisted in migrating billing to PostgreSQL' },
      { place: { lineId: 'l2' }, after: 'Go, Python, PostgreSQL' },
    ]);
    expect(
      (await callTool('propose_replace_everywhere', { find: 'Skills', replace: 'Tools' })).content
    ).toContain('in no bullet or line');
  });
});

describe("checking the model's work", () => {
  it('tells the model what the checks noticed, and the result only where our code wrote it', async () => {
    await readTheResume();
    const plain = await callTool('propose_rewrite', {
      id: 'b3',
      text: 'Wrote the payments on-call runbook',
    });
    expect(plain.content).toBe('Suggested for b3.\nChecks: none.');
    const replaced = await callTool('propose_replace_everywhere', {
      find: 'caching',
      replace: 'caches',
    });
    expect(replaced.content).toBe(
      'Suggested for b4. It would read: "Built tile caches for the Oslo office"\nChecks: none.'
    );
    const bigger = await callTool('propose_rewrite', {
      id: 'b1',
      text: 'Led migrating billing to Postgres',
    });
    expect(bigger.content).toContain('sound bigger than the original');
  });

  it('sends a doubled word back once, then stages the second try flagged', async () => {
    await readTheResume();
    const doubled = {
      id: 'b2',
      text: 'Reduced reduce p99 latency from 18% to 3% of requests',
    };
    const first = await callTool('propose_rewrite', doubled);
    expect(first).toMatchObject({
      isError: true,
      content: expect.stringContaining('Propose it again'),
    });
    expect(stagedSuggestions()).toEqual([]);

    const second = await callTool('propose_rewrite', doubled);
    expect(second.isError).toBe(false);
    expect(stagedSuggestions()[0].flags.map((flag) => flag.kind)).toContain('doubledWords');
  });

  it("replaces the run's earlier suggestion for the same bullet", async () => {
    await readTheResume();
    await callTool('propose_rewrite', { id: 'b3', text: 'Wrote the payments runbook' });
    await callTool('propose_select', { id: 'b3', show: false });
    await callTool('propose_rewrite', { id: 'b3', text: 'Wrote the on-call runbook' });
    expect(stagedSuggestions().map((proposal) => proposal.change)).toMatchObject([
      { kind: 'select', place: { bulletId: 'b3' } },
      { kind: 'rewrite', after: 'Wrote the on-call runbook' },
    ]);
  });
});

describe('read_newest_version', () => {
  const makeVersion = (doc: ResumeData): Version => ({
    id: 'v1',
    templateId: 't1',
    number: 4,
    revision: 1,
    parentId: null,
    kind: 'named',
    source: 'name',
    summary: 'Sent to Harbor',
    section: null,
    rev: 2,
    createdAt: new Date(2026, 9, 20, 14, 3).getTime(),
    doc,
  });

  it('names the version and says what the draft changed since', async () => {
    const version = makeVersion(withBulletText('b1', 'Helped migrate billing'));
    storedVersions.list = [version];
    storedVersions.doc = version.doc;
    const { content, isError } = await callTool('read_newest_version');
    expect(isError).toBe(false);
    expect(content).toContain('Newest version: v4.1 "Sent to Harbor", saved 2026-10-20 14:03.');
    expect(content).toMatch(/Since then: .*\(in Experience\)\./);
    expect(content).toContain('- b1: Helped migrate billing');
  });

  it('says when the draft is the same', async () => {
    const version = makeVersion(makeResume());
    storedVersions.list = [version];
    storedVersions.doc = version.doc;
    expect((await callTool('read_newest_version')).content).toContain('The draft is the same');
  });
});

describe('any call', () => {
  it('answers an unknown tool or a missing argument as an error', async () => {
    expect((await callTool('delete_everything')).content).toBe(
      'There is no tool named delete_everything.'
    );
    await readTheResume();
    expect((await callTool('propose_rewrite', { id: 'b1' })).content).toBe(
      'text is needed. text: The whole new bullet or line.'
    );
  });
});

describe('reading the arguments the one way they can be read', () => {
  beforeEach(() => openDraft(makeResumeWithLines()));

  const lastChange = () => stagedSuggestions().at(-1)?.change;

  it('takes a handle in another case, inside other text, or at the end of its path', async () => {
    await readTheResume();
    for (const [id, show] of [
      ['B2', false],
      ['handle b3.', false],
      ['e1b1', false],
    ] as const) {
      const result = await callTool('propose_select', { id, show });
      expect(result.content).toMatch(/^Took ".*" as "b\d"\.\n/);
    }
    expect(stagedSuggestions().map((proposal) => proposal.change)).toMatchObject([
      { place: { bulletId: 'b2' } },
      { place: { bulletId: 'b3' } },
      { place: { bulletId: 'b1' } },
    ]);
  });

  it("takes an item's own words where its handle goes, when one item has them", async () => {
    await readTheResume();
    const result = await callTool('propose_rewrite', {
      id: 'Go, Python, Postgres',
      text: 'Go, Python, PostgreSQL',
    });
    expect(result.content).toMatch(/^Took "Go, Python, Postgres" as "l2"\.\nSuggested for l2\./);
    expect(lastChange()).toMatchObject({ place: { lineId: 'l2' } });
  });

  it("refuses a path whose handles don't hold each other, or two handles in one", async () => {
    await readTheResume();
    for (const id of ['e2b1', 'b1 or b2']) {
      const result = await callTool('propose_select', { id, show: false });
      expect(result).toMatchObject({
        isError: true,
        content: expect.stringContaining("doesn't fit id"),
      });
    }
    expect(stagedSuggestions()).toEqual([]);
  });

  it('reads each handle of a list', async () => {
    await readTheResume();
    const result = await callTool('propose_reorder', { order: ['L3', 'l2'] });
    expect(result.content).toMatch(/^Took order as \["l3","l2"\]\.\n/);
    expect(lastChange()).toMatchObject({ after: ['l3', 'l2'] });
  });
});
