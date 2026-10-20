export type HistoryKindFilter = 'all' | 'named' | 'events';

/**
 * What a version is read against: the version before it, the version before its number
 * (everything the number did, for one with revisions), or the draft.
 */
export type HistoryComparison = 'parent' | 'number' | 'draft';

/** How the full history shows the version being read: as it prints, or only what changed. */
export type ReadPaneView = 'page' | 'changes';

/**
 * The moments that get a history row of their own, besides naming one. The draft is saved
 * as you type regardless.
 */
export type SnapshotTrigger = 'beforeRestore' | 'onImport' | 'whileWorking' | 'afterAiEdits';

/** The kinds of history row a tip explains, in the order they are explained. */
export const HISTORY_TIP_IDS = ['auto', 'named', 'rev', 'event', 'ai', 'stop', 'fold'] as const;
export type HistoryTipId = (typeof HISTORY_TIP_IDS)[number];

/** How many times a tip was shown and left, or `got` once it is seen for good. */
export type HistoryTipSeen = number | 'got';

export interface HistoryTips {
  /** Off stops new tips; what is seen stays seen. */
  isOn: boolean;
  seen: Partial<Record<HistoryTipId, HistoryTipSeen>>;
}

/** How many days old an automatic snapshot is before it folds; null never folds. */
export type SnapshotFoldDays = 30 | 90 | null;

export interface HistoryFilter {
  kind: HistoryKindFilter;
  /** A section label, or null for any section. */
  section: string | null;
  query: string;
}
