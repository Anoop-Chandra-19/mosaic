import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Version, VersionMeta } from '@shared/types/db';
import type { ResumeData } from '@shared/types/resume';
import { makeResume } from '../../../suggestions/proposals/__tests__/proposalFixtures';

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

  it('marks hidden bullets and leaves lines sections without handles', async () => {
    const doc = makeResume();
    doc.sections[0].items[0].bullets[0].selected = false;
    doc.sections.push({
      id: 'sum',
      kind: 'summary',
      layout: 'lines',
      label: 'Summary',
      order: 1,
      items: [{ id: 'l1', selected: true, bullets: [], text: 'Ten years of backend work' }],
    });
    openDraft(doc);
    const { content } = await readTheResume();
    expect(content).toContain('- b1 (hidden): Assisted');
    expect(content).toContain('## Summary (lines, read only)\n- Ten years of backend work');
  });

  it('says so when no resume is open', async () => {
    useResumeStore.getState().loadDraft(null);
    expect(await readTheResume()).toMatchObject({ isError: true, draft: null });
  });
});

describe('the propose tools', () => {
  it('refuse until the resume is read', async () => {
    const result = await callTool('propose_rewrite', { bulletId: 'b1', text: 'Led billing' });
    expect(result).toMatchObject({
      isError: true,
      content: expect.stringContaining('read_document'),
    });
    expect(stagedSuggestions()).toEqual([]);
  });

  it('stage a rewrite against the text the run read', async () => {
    await readTheResume();
    const result = await callTool('propose_rewrite', {
      bulletId: 'b1',
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
    const result = await callTool('propose_rewrite', { bulletId: 'b1', text: 'Led billing' });
    expect(result).toMatchObject({
      isError: true,
      content: expect.stringContaining('Read it again'),
    });
  });

  it('refuse when another resume is open than the one read', async () => {
    await readTheResume();
    openDraft(makeResume(), 't2');
    expect((await callTool('propose_select', { bulletId: 'b1', show: false })).content).toContain(
      'Another resume is open'
    );
  });

  it('name an unknown handle', async () => {
    await readTheResume();
    const result = await callTool('propose_rewrite', { bulletId: 'b9', text: 'x' });
    expect(result.content).toContain('No bullet "b9"');
  });

  it('need the version without a number for a {{?}} gap', async () => {
    await readTheResume();
    expect(
      (await callTool('propose_rewrite', { bulletId: 'b3', text: 'Cut pages by {{?}}%' })).isError
    ).toBe(true);
    await callTool('propose_rewrite', {
      bulletId: 'b3',
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

  it("reorder entries, or an entry's bullets, by handle", async () => {
    await readTheResume();
    await callTool('propose_reorder', { sectionId: 's1', order: ['e2', 'e1'] });
    await callTool('propose_reorder', {
      sectionId: 's1',
      entryId: 'e1',
      order: '["b3","b1","b2"]',
    });
    expect(stagedSuggestions().map((proposal) => proposal.change)).toMatchObject([
      { kind: 'reorder', after: ['e2', 'e1'] },
      { kind: 'reorder', place: { entryId: 'e1' }, after: ['b3', 'b1', 'b2'] },
    ]);
    expect(
      (await callTool('propose_reorder', { sectionId: 's1', order: ['e2'] })).content
    ).toContain('same ids');
  });

  it('hide a bullet, taking "false" as false', async () => {
    await readTheResume();
    await callTool('propose_select', { bulletId: 'b2', show: 'false' });
    expect(stagedSuggestions()[0].change).toMatchObject({ kind: 'select', selected: false });
  });

  it('draft a new entry with only the facts given', async () => {
    await readTheResume();
    await callTool('propose_entry', {
      sectionId: 's1',
      afterEntryId: 'e1',
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
});

describe("checking the model's work", () => {
  it('tells the model what each suggestion would make, and what the checks noticed', async () => {
    await readTheResume();
    const plain = await callTool('propose_rewrite', {
      bulletId: 'b3',
      text: 'Wrote the payments on-call runbook',
    });
    expect(plain.content).toBe(
      'Suggested for b3. It would read: "Wrote the payments on-call runbook"\nChecks: none.'
    );
    const bigger = await callTool('propose_rewrite', {
      bulletId: 'b1',
      text: 'Led migrating billing to Postgres',
    });
    expect(bigger.content).toContain('sound bigger than the original');
  });

  it('sends a doubled word back once, then stages the second try flagged', async () => {
    await readTheResume();
    const doubled = {
      bulletId: 'b2',
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
    await callTool('propose_rewrite', { bulletId: 'b3', text: 'Wrote the payments runbook' });
    await callTool('propose_select', { bulletId: 'b3', show: false });
    await callTool('propose_rewrite', { bulletId: 'b3', text: 'Wrote the on-call runbook' });
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
    expect((await callTool('propose_rewrite', { bulletId: 'b1' })).content).toBe(
      'text is needed, as text.'
    );
  });
});
