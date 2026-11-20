import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MosaicDb, MosaicDbBridge } from '@shared/types/dbBridge';
import type { Proposal, ProposalChange } from '@/types/agentProposal';
// The real main-process database code over SQLite in memory, minus the IPC hop.
import { openDatabase, type Database } from '../../../../../../main/db/connection';
import { createDbHandlers, settle } from '../../../../../../main/ipc/dbHandlers';
import { makeResume, rewrite } from './proposalFixtures';

const db = vi.hoisted(() => ({ current: undefined as MosaicDb | undefined }));
vi.mock('@/lib/services/mosaicDb', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/services/mosaicDb')>()),
  getDb: () => db.current,
}));

const { unwrapBridge } = await import('@/lib/services/mosaicDb');
const { flushDraft, useResumeStore } = await import('@/stores/resumeStore');
const { useTemplateStore } = await import('@/stores/templateStore');
const { DEFAULT_PREFERENCES, useUiStore } = await import('@/stores/uiStore');
const { useProposalStore } = await import('@/stores/proposalStore');
const {
  acceptProposals,
  chooseBulletWithoutNumber,
  confirmProposalFact,
  editProposal,
  editProposalFact,
  fillBulletNumber,
  fillProposalNumber,
  keepProposalVersion,
  leaveEntryOut,
  putEntryBack,
  rejectProposals,
  returnProposals,
  reviewStaleProposalAnyway,
  stageProposals,
} = await import('../proposalActions');
const { applyAcceptedProposals } = await import('../apply/applyAcceptedProposals');
const { listNewContentIds } = await import('../newContentIds');
const { findUnconfirmedFacts, resolveChange } = await import('../reviewedChange');
const { readActiveVersion } = await import('../proposalVersions');

let sqlite: Database;

/** A bridge that answers the way main does, straight from the handlers. */
function inProcessBridge(handlers: object): MosaicDbBridge {
  const wrap = (node: object): object =>
    Object.fromEntries(
      Object.entries(node).map(([key, value]) => [
        key,
        typeof value === 'function'
          ? async (...args: unknown[]) => settle(() => value(...args))
          : wrap(value),
      ])
    );
  return wrap(handlers) as MosaicDbBridge;
}

const resume = () => useResumeStore.getState();
const bulletText = (bulletId: string) =>
  resume()
    .sections.flatMap((section) => section.items)
    .flatMap((entry) => entry.bullets)
    .find((bullet) => bullet.id === bulletId)?.text;
const proposals = () => useProposalStore.getState().byTemplate[resume().templateId!] ?? [];
const activeVersions = () => proposals().map(readActiveVersion);

/** The id staging gave a suggested new entry. */
function readNewEntryId(proposal: Proposal): string {
  const { newContentIds } = readActiveVersion(proposal);
  return newContentIds?.kind === 'entry' ? newContentIds.entry.entryId : '';
}

const B1 = 'Assisted in migrating billing to Postgres';
const B2 = 'Reduced p99 latency from 18% to 3% of requests';
const B3 = 'Wrote the on-call runbook for the payments team';
const B4 = 'Built tile caching for the Oslo office';

describe('ids of what a suggestion adds', () => {
  it('are set at staging and are the ids in the applied draft', async () => {
    const split: ProposalChange = {
      kind: 'split',
      sectionId: 's1',
      entryId: 'e1',
      bulletId: 'b2',
      before: B2,
      at: 'Reduced p99 latency'.length,
    };
    const [staged] = stageProposals('', [{ source: 'split', change: split }]).proposals;
    const secondHalfId = listNewContentIds(readActiveVersion(staged).newContentIds)[0];
    expect(secondHalfId).toEqual(expect.any(String));

    acceptProposals([staged.id]);
    await applyAcceptedProposals();

    expect(bulletText(secondHalfId)).toBe('from 18% to 3% of requests');
  });
});

/** What a mid-tier model's run gave back in the spike, written out by hand. */
const SPIKE_LIKE_CHANGES = [
  { source: 'rewrite', change: rewrite('b1', B1, 'Led the billing migration to Postgres') },
  { source: 'rewrite', change: rewrite('b2', B2, 'Reduced reduce p99 latency from 18% to 3%') },
  {
    source: 'rewrite',
    change: {
      ...rewrite('b3', B3, 'Wrote the on-call runbook that cut pages by {{?}}%'),
      gap: { withoutNumber: 'Wrote the on-call runbook that cut pages for payments' },
    },
  },
  {
    source: 'replace',
    change: {
      kind: 'rewrite',
      place: { unit: 'bullet', sectionId: 's1', entryId: 'e2', bulletId: 'b4' },
      before: B4,
      after: 'Built tile caching for the Oslo and Bergen offices',
    },
  },
  { source: 'rewrite', change: rewrite('b9', 'Gone', 'Still gone') },
] as const satisfies { source: 'rewrite' | 'replace'; change: ProposalChange }[];

beforeEach(async () => {
  sqlite = openDatabase(':memory:');
  db.current = unwrapBridge(inProcessBridge(createDbHandlers(sqlite)));
  useTemplateStore.getState().load([]);
  resume().loadDraft(null);
  useProposalStore.setState({ byTemplate: {} });
  useUiStore.setState({ snapshotTriggers: { ...DEFAULT_PREFERENCES.snapshotTriggers } });
  await useTemplateStore.getState().createTemplate('Backend', makeResume());
});

afterEach(async () => {
  await flushDraft();
  sqlite.close();
});

describe('a run of suggestions, start to finish', () => {
  it('stages, flags, reviews, applies as one undo step with a version, and undoes', async () => {
    const staged = stageProposals('Tighten my experience bullets', [...SPIKE_LIKE_CHANGES]);

    expect(staged.refusals).toEqual([
      { index: 4, refusal: expect.objectContaining({ code: 'unknown-target' }) },
    ]);
    const [led, doubled, gap, replace] = staged.proposals;
    const flagKinds = (proposal: Proposal) =>
      readActiveVersion(proposal).flags.map((flag) => flag.kind);
    expect(flagKinds(led)).toEqual(['claimsMore']);
    expect(flagKinds(doubled)).toEqual(['doubledWords']);
    expect(flagKinds(gap)).toContain('unfilledGap');
    expect(readActiveVersion(replace).flags).toEqual([{ kind: 'newNames', words: ['Bergen'] }]);
    // Nothing touches the draft until it is applied.
    expect(bulletText('b1')).toBe(B1);

    rejectProposals([led.id]);
    expect(editProposal(doubled.id, 'Cut p99 latency from 18% to 3% of requests')).toBe(true);
    acceptProposals([gap.id, replace.id]);

    const outcome = await applyAcceptedProposals();

    expect(outcome.kind).toBe('applied');
    const plan = outcome.kind === 'applied' ? outcome.plan : null;
    expect(plan?.landed.map((p) => p.id)).toEqual([doubled.id, replace.id]);
    expect(plan?.held.map((p) => p.id)).toEqual([gap.id]);
    expect(plan?.skipped).toEqual([]);
    expect(bulletText('b1')).toBe(B1);
    expect(bulletText('b2')).toBe('Cut p99 latency from 18% to 3% of requests');
    expect(bulletText('b4')).toBe('Built tile caching for the Oslo and Bergen offices');
    expect(resume().undoLabel).toBe('apply 2 suggestions');
    const versions = await db.current!.versions.list(resume().templateId!);
    expect(versions[0]).toMatchObject({
      source: 'assistant',
      summary: '2 suggestions in Harbor Freight Labs and Lantern Maps',
    });

    resume().undo();
    expect(bulletText('b2')).toBe(B2);
    expect(bulletText('b4')).toBe(B4);
    // Undo moves the draft; history keeps what was applied.
    expect(await db.current!.versions.list(resume().templateId!)).toHaveLength(versions.length);
  });

  it('keeps no versions when the user turned that off, and still applies', async () => {
    useUiStore.setState({
      snapshotTriggers: { ...DEFAULT_PREFERENCES.snapshotTriggers, afterAiEdits: false },
    });
    const before = await db.current!.versions.list(resume().templateId!);
    const { proposals: staged } = stageProposals('', [SPIKE_LIKE_CHANGES[3]]);
    acceptProposals([staged[0].id]);

    await applyAcceptedProposals();

    expect(bulletText('b4')).toBe('Built tile caching for the Oslo and Bergen offices');
    expect(await db.current!.versions.list(resume().templateId!)).toHaveLength(before.length);
  });
});

describe('review', () => {
  it('filling the number keeps it, and it lands with the number', async () => {
    const [gap] = stageProposals('', [SPIKE_LIKE_CHANGES[2]]).proposals;

    expect(fillProposalNumber(gap.id, '30')).toBe(true);
    expect(proposals()[0].status).toBe('accepted');
    expect(activeVersions()[0].flags).toEqual([]);
    await applyAcceptedProposals();

    expect(bulletText('b3')).toBe('Wrote the on-call runbook that cut pages by 30%');
  });

  it('a new entry is kept only once each of its facts is confirmed', () => {
    const [entry] = stageProposals('add my mentoring', [
      {
        source: 'entry',
        change: {
          kind: 'entry',
          sectionId: 's1',
          frame: { title: 'Mentor', dates: '2021' },
          bullets: ['Mentored new engineers'],
        },
      },
    ]).proposals;

    const entryId = readNewEntryId(entry);
    acceptProposals([entry.id]);
    expect(proposals()[0].status).toBe('pending');
    confirmProposalFact(entry.id, { entryId, fact: 'title' }, true);
    editProposalFact(entry.id, { entryId, fact: 'dates' }, '2021 – Present');
    acceptProposals([entry.id]);
    expect(proposals()[0].status).toBe('accepted');

    confirmProposalFact(entry.id, { entryId, fact: 'title' }, false);
    expect(proposals()[0].status).toBe('pending');
  });

  it('a bullet added to a new entry keeps its number to fill, which holds the entry back until it is filled', async () => {
    const [entry] = stageProposals('add my mentoring', [
      {
        source: 'entry',
        change: { kind: 'entry', sectionId: 's1', frame: { title: 'Mentor' }, bullets: [] },
      },
    ]).proposals;
    const entryId = readNewEntryId(entry);
    const added = stageProposals('add my mentoring', [
      {
        source: 'add',
        change: {
          kind: 'add',
          place: { unit: 'bullet', sectionId: 's1', entryId },
          afterId: null,
          text: 'Mentored {{?}} new engineers',
          gap: { withoutNumber: 'Mentored new engineers' },
        },
      },
    ]);
    expect(added.filled).toHaveLength(1);
    const { filledIds } = added.filled[0];
    const bulletId = filledIds.kind === 'add' ? filledIds.id : '';
    expect(activeVersions()[0].flags).toEqual([
      { kind: 'unfilledGap', words: ['{{?}}'], textId: bulletId },
    ]);

    confirmProposalFact(entry.id, { entryId, fact: 'title' }, true);
    acceptProposals([entry.id]);
    await applyAcceptedProposals();
    expect(bulletText(bulletId)).toBeUndefined();

    expect(fillBulletNumber(entry.id, bulletId, '4')).toBe(true);
    expect(proposals()[0].status).toBe('accepted');
    expect(activeVersions()[0].flags).toEqual([]);
    await applyAcceptedProposals();
    expect(bulletText(bulletId)).toBe('Mentored 4 new engineers');
  });

  it('a bullet of a new entry can take its version without a number, and go back', () => {
    const [entry] = stageProposals('add my mentoring', [
      {
        source: 'entry',
        change: { kind: 'entry', sectionId: 's1', frame: { title: 'Mentor' }, bullets: [] },
      },
    ]).proposals;
    const entryId = readNewEntryId(entry);
    const { filled } = stageProposals('', [
      {
        source: 'add',
        change: {
          kind: 'add',
          place: { unit: 'bullet', sectionId: 's1', entryId },
          afterId: null,
          text: 'Mentored {{?}} new engineers',
          gap: { withoutNumber: 'Mentored new engineers' },
        },
      },
    ]);
    const bulletId = filled[0].filledIds.kind === 'add' ? filled[0].filledIds.id : '';
    const bulletsOf = () => {
      const change = resolveChange(activeVersions()[0]);
      return change.kind === 'entry' ? change.bullets : [];
    };

    fillBulletNumber(entry.id, bulletId, '4');
    chooseBulletWithoutNumber(entry.id, bulletId, true);
    expect(bulletsOf()).toEqual(['Mentored new engineers']);
    expect(activeVersions()[0].flags).toEqual([]);

    chooseBulletWithoutNumber(entry.id, bulletId, false);
    expect(bulletsOf()).toEqual(['Mentored {{?}} new engineers']);
    expect(activeVersions()[0].flags.map((flag) => flag.kind)).toEqual(['unfilledGap']);
  });

  it('a new section keeps the entries still on it: one left out is not applied, and the last can’t be', async () => {
    const [section] = stageProposals('add my volunteering', [
      {
        source: 'section',
        change: {
          kind: 'section',
          afterSectionId: 's1',
          section: { kind: 'volunteering', layout: 'entries', label: 'Volunteering' },
          contents: {
            layout: 'entries',
            entries: [
              { frame: { title: 'Mentor' }, bullets: ['Mentored new contributors'] },
              { frame: { title: 'Organizer' }, bullets: ['Ran the monthly meetup'] },
            ],
          },
        },
      },
    ]).proposals;
    const ids = readActiveVersion(section).newContentIds;
    const [mentorIds, organizerIds] =
      ids?.kind === 'section' && ids.contents?.layout === 'entries' ? ids.contents.entries : [];

    expect(leaveEntryOut(section.id, organizerIds.entryId)).toBe(true);
    expect(() => leaveEntryOut(section.id, mentorIds.entryId)).toThrow(
      /it is the only entry not left out/
    );
    // A left-out entry's facts need nothing: only the mentor's title is left to confirm.
    confirmProposalFact(section.id, { entryId: mentorIds.entryId, fact: 'title' }, true);
    acceptProposals([section.id]);
    await applyAcceptedProposals();

    const volunteering = resume().sections.find((each) => each.label === 'Volunteering');
    expect(volunteering?.items.map(({ id, title }) => [id, title])).toEqual([
      [mentorIds.entryId, 'Mentor'],
    ]);
  });

  it('a left-out entry put back needs its facts again', () => {
    const [section] = stageProposals('add my volunteering', [
      {
        source: 'section',
        change: {
          kind: 'section',
          afterSectionId: 's1',
          section: { kind: 'volunteering', layout: 'entries', label: 'Volunteering' },
          contents: {
            layout: 'entries',
            entries: [
              { frame: { title: 'Mentor' }, bullets: [] },
              { frame: { title: 'Organizer' }, bullets: [] },
            ],
          },
        },
      },
    ]).proposals;
    const ids = readActiveVersion(section).newContentIds;
    const [mentorIds, organizerIds] =
      ids?.kind === 'section' && ids.contents?.layout === 'entries' ? ids.contents.entries : [];
    confirmProposalFact(section.id, { entryId: mentorIds.entryId, fact: 'title' }, true);
    leaveEntryOut(section.id, organizerIds.entryId);
    acceptProposals([section.id]);
    expect(proposals()[0].status).toBe('accepted');

    putEntryBack(section.id, organizerIds.entryId);
    expect(findUnconfirmedFacts(activeVersions()[0])).toEqual([
      { entryId: organizerIds.entryId, fact: 'title' },
    ]);
  });

  it('an out-of-date rewrite can be reviewed against the edited bullet, and then replaces it', async () => {
    const [led] = stageProposals('', [SPIKE_LIKE_CHANGES[0]]).proposals;
    resume().updateBullet('s1', 'e1', 'b1', 'Moved billing to Postgres');
    expect(proposals()[0].isStale).toBe(true);

    expect(reviewStaleProposalAnyway(led.id)).toBe(true);
    expect(proposals()[0]).toMatchObject({ isStale: false, status: 'pending' });
    acceptProposals([led.id]);
    await applyAcceptedProposals();

    expect(bulletText('b1')).toBe('Led the billing migration to Postgres');
  });

  it('adds to the assistant’s version only while the draft still matches it', async () => {
    const [led, doubled] = stageProposals('', [...SPIKE_LIKE_CHANGES.slice(0, 2)]).proposals;
    acceptProposals([led.id]);
    expect(await applyAcceptedProposals({ mode: 'add' })).toEqual({ kind: 'cannotAdd' });

    await applyAcceptedProposals();
    const [first] = await db.current!.versions.list(resume().templateId!);
    editProposal(doubled.id, 'Cut p99 latency from 18% to 3% of requests');
    expect((await applyAcceptedProposals({ mode: 'add' })).kind).toBe('applied');

    expect((await db.current!.versions.list(resume().templateId!))[0]).toMatchObject({
      number: first.number,
      revision: 1,
    });
  });
});

describe('a second rewrite of a bullet that a kept rewrite already changed', () => {
  const REWRITTEN = 'Led the billing migration to Postgres';
  const SHORTER = 'Led billing to Postgres';
  /** Stage a rewrite of b1 and keep it, then stage a rewrite of the text the first one wrote. */
  const stageTwoRewrites = () => {
    const [first] = stageProposals('', [SPIKE_LIKE_CHANGES[0]]).proposals;
    acceptProposals([first.id]);
    const secondChange = rewrite('b1', REWRITTEN, SHORTER);
    const staged = stageProposals('', [{ source: 'rewrite', change: secondChange }]);
    return { first, staged };
  };
  const card = (id: string) => proposals().find((each) => each.id === id)!;

  it('is a second version of the same card, built on the kept one, and the kept one still applies', async () => {
    const { first, staged } = stageTwoRewrites();
    expect(staged.proposals).toEqual([]);
    expect(staged.reworded).toMatchObject([{ isNewVersion: true, isRemoved: false }]);

    const { versions, keptVersionId } = card(first.id);
    expect(versions.map((version) => version.change)).toMatchObject([
      { kind: 'rewrite', before: B1, after: REWRITTEN },
      { kind: 'rewrite', before: B1, after: SHORTER },
    ]);
    expect(keptVersionId).toBe(versions[0].id);

    await applyAcceptedProposals();
    expect(bulletText('b1')).toBe(REWRITTEN);
  });

  it('applies the second version once the user keeps it instead', async () => {
    const { first } = stageTwoRewrites();
    const second = card(first.id).versions[1];

    expect(keepProposalVersion(first.id, second.id)).toBe(true);
    expect(card(first.id)).toMatchObject({ status: 'accepted', keptVersionId: second.id });
    await applyAcceptedProposals();

    expect(bulletText('b1')).toBe(SHORTER);
  });

  it('goes into the waiting second version, not a third, while the first stays kept', () => {
    const { first } = stageTwoRewrites();
    const again = rewrite('b1', REWRITTEN, 'Moved billing to Postgres');
    stageProposals('', [{ source: 'rewrite', change: again }]);

    const { versions, keptVersionId } = card(first.id);
    expect(versions).toHaveLength(2);
    expect(versions[1].change).toMatchObject({ after: 'Moved billing to Postgres' });
    expect(keptVersionId).toBe(versions[0].id);
  });

  it('falls back to the newest version on Undo keep, and back to the kept one on Undo drop', () => {
    const { first } = stageTwoRewrites();
    const [kept, newest] = card(first.id).versions;

    rejectProposals([first.id]);
    returnProposals([first.id]);
    expect(card(first.id)).toMatchObject({ status: 'accepted', keptVersionId: kept.id });

    returnProposals([first.id]);
    expect(card(first.id)).toMatchObject({ status: 'pending', keptVersionId: null });
    expect(readActiveVersion(card(first.id)).id).toBe(newest.id);
  });

  it('keeps the version the user edits, and checks it against your bullet', () => {
    const { first } = stageTwoRewrites();
    const second = card(first.id).versions[1];

    expect(editProposal(first.id, 'Led billing', second.id)).toBe(true);
    expect(card(first.id)).toMatchObject({
      isStale: false,
      status: 'accepted',
      keptVersionId: second.id,
    });
    expect(resolveChange(card(first.id).versions[1])).toMatchObject({
      before: B1,
      after: 'Led billing',
    });
  });

  it('carries the number the user gave into the new version, so it is not flagged as new', () => {
    const [first] = stageProposals('', [
      {
        source: 'rewrite',
        change: {
          ...rewrite('b1', B1, 'Led the billing migration to Postgres for {{?}} customers'),
          gap: { withoutNumber: REWRITTEN },
        },
      },
    ]).proposals;
    fillProposalNumber(first.id, '40');
    const withNumber = 'Led the billing migration to Postgres for 40 customers';
    stageProposals('', [
      { source: 'rewrite', change: rewrite('b1', withNumber, 'Moved 40 customers to Postgres') },
    ]);

    const second = card(first.id).versions[1];
    expect(second.flags.filter((flag) => flag.kind === 'newNumbers')).toEqual([]);
    expect(second.review).toEqual({});
  });
});

describe('a split of a bullet that a kept rewrite already changed', () => {
  const REWRITTEN = 'Led the billing migration to Postgres';

  it('goes out of date when the rewrite is dropped, and is current again when the drop is undone', () => {
    const [first] = stageProposals('', [SPIKE_LIKE_CHANGES[0]]).proposals;
    acceptProposals([first.id]);
    const split: ProposalChange = {
      kind: 'split',
      sectionId: 's1',
      entryId: 'e1',
      bulletId: 'b1',
      before: REWRITTEN,
      at: REWRITTEN.indexOf('to Postgres'),
    };
    const [second] = stageProposals('', [{ source: 'split', change: split }]).proposals;
    const isSecondStale = () => proposals().find((each) => each.id === second.id)?.isStale;

    rejectProposals([first.id]);
    expect(isSecondStale()).toBe(true);

    returnProposals([first.id]);
    expect(isSecondStale()).toBe(false);

    acceptProposals([second.id]);
    returnProposals([first.id]);
    expect(proposals().find((each) => each.id === second.id)?.status).toBe('pending');
  });

  it('keeps a waiting rewrite when a split of its text is kept, and no unrelated suggestion', () => {
    const [unrelated] = stageProposals('', [SPIKE_LIKE_CHANGES[3]]).proposals;
    const [first] = stageProposals('', [SPIKE_LIKE_CHANGES[0]]).proposals;
    const rewritten = 'Led the billing migration to Postgres';
    const split: ProposalChange = {
      kind: 'split',
      sectionId: 's1',
      entryId: 'e1',
      bulletId: 'b1',
      before: rewritten,
      at: rewritten.indexOf('to Postgres'),
    };
    const [second] = stageProposals('', [{ source: 'split', change: split }]).proposals;

    acceptProposals([second.id]);

    const statusOf = (id: string) => proposals().find((each) => each.id === id)?.status;
    expect(statusOf(first.id)).toBe('accepted');
    expect(statusOf(unrelated.id)).toBe('pending');
  });
});

describe('staleness', () => {
  it('goes stale when its bullet is edited, back to current on undo, and never applies stale', async () => {
    const { proposals: staged } = stageProposals('', [SPIKE_LIKE_CHANGES[0]]);
    acceptProposals([staged[0].id]);

    resume().updateBullet('s1', 'e1', 'b1', 'Moved billing to Postgres');
    expect(proposals()[0].isStale).toBe(true);
    expect((await applyAcceptedProposals()).kind).toBe('nothing');
    expect(bulletText('b1')).toBe('Moved billing to Postgres');

    resume().undo();
    expect(proposals()[0].isStale).toBe(false);
  });

  it('an edit to another bullet leaves it current', () => {
    stageProposals('', [SPIKE_LIKE_CHANGES[0]]);
    resume().updateBullet('s1', 'e1', 'b3', 'Wrote the runbook');
    expect(proposals()[0].isStale).toBe(false);
  });

  it('each template keeps its own, through switching away and back', async () => {
    stageProposals('', [SPIKE_LIKE_CHANGES[0]]);
    const backend = resume().templateId!;

    await useTemplateStore.getState().createTemplate('Frontend', makeResume());
    expect(proposals()).toEqual([]);

    await useTemplateStore.getState().openTemplate(backend);
    expect(proposals()).toHaveLength(1);
    expect(proposals()[0].isStale).toBe(false);
  });
});
