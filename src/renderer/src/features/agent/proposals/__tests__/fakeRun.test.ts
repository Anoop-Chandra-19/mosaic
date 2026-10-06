import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MosaicDb, MosaicDbBridge } from '@shared/types/db';
import type { ProposalChange } from '@shared/types/agent';
// The real main-process database code over SQLite in memory, minus the IPC hop.
import { openDatabase, type Database } from '../../../../../../main/db/connection';
import { createDbHandlers, settle } from '../../../../../../main/ipc/dbHandlers';
import { makeResume, rewrite } from './proposalFixtures';

const db = vi.hoisted(() => ({ current: undefined as MosaicDb | undefined }));
vi.mock('@/lib/storage/mosaicDb', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/storage/mosaicDb')>()),
  getDb: () => db.current,
}));

const { unwrapBridge } = await import('@/lib/storage/mosaicDb');
const { flushDraft, useResumeStore } = await import('@/stores/resumeStore');
const { useTemplateStore } = await import('@/stores/templateStore');
const { DEFAULT_PREFERENCES, useUiStore } = await import('@/stores/uiStore');
const { useProposalStore } = await import('@/stores/proposalStore');
const { acceptProposals, editProposal, rejectProposals, stageProposals } =
  await import('../proposalActions');
const { applyAcceptedProposals } = await import('../applyAcceptedProposals');

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

const B1 = 'Assisted in migrating billing to Postgres';
const B2 = 'Reduced p99 latency from 18% to 3% of requests';
const B3 = 'Wrote the on-call runbook for the payments team';
const B4 = 'Built tile caching for the Oslo office';

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
      sectionId: 's1',
      entryId: 'e2',
      bulletId: 'b4',
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
    expect(led.flags.map((flag) => flag.kind)).toEqual(['claimsMore']);
    expect(doubled.flags.map((flag) => flag.kind)).toEqual(['doubledWords']);
    expect(gap.flags.map((flag) => flag.kind)).toContain('unfilledGap');
    expect(replace.flags).toEqual([]);
    // Nothing touches the draft until it is applied.
    expect(bulletText('b1')).toBe(B1);

    rejectProposals([led.id]);
    expect(editProposal(doubled.id, 'Cut p99 latency from 18% to 3% of requests')).toBe(true);
    acceptProposals([gap.id, replace.id]);

    const outcome = await applyAcceptedProposals();

    expect(outcome).toEqual({
      appliedIds: [doubled.id, replace.id],
      skippedIds: [],
      blockedIds: [gap.id],
    });
    expect(bulletText('b1')).toBe(B1);
    expect(bulletText('b2')).toBe('Cut p99 latency from 18% to 3% of requests');
    expect(bulletText('b4')).toBe('Built tile caching for the Oslo and Bergen offices');
    expect(resume().undoLabel).toBe('apply 2 suggestions');
    const versions = await db.current!.versions.list(resume().templateId!);
    expect(versions[0]).toMatchObject({
      source: 'assistant',
      summary: 'Applied 2 of 4 suggestions',
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

describe('staleness', () => {
  it('goes stale when its bullet is edited, back to current on undo, and never applies stale', async () => {
    const { proposals: staged } = stageProposals('', [SPIKE_LIKE_CHANGES[0]]);
    acceptProposals([staged[0].id]);

    resume().updateBullet('s1', 'e1', 'b1', 'Moved billing to Postgres');
    expect(proposals()[0].isStale).toBe(true);
    expect((await applyAcceptedProposals()).appliedIds).toEqual([]);
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
