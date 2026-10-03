export type HistoryKindFilter = 'all' | 'named' | 'events';

/** What a version is read against: the version before it, or the draft. */
export type HistoryComparison = 'parent' | 'draft';

/**
 * The moments that get a history row of their own, besides naming one. The draft is saved
 * as you type regardless.
 */
export type SnapshotTrigger = 'beforeRestore' | 'onImport' | 'whileWorking' | 'afterAiEdits';

/** How many days old an automatic snapshot is before it folds; null never folds. */
export type SnapshotFoldDays = 30 | 90 | null;

export interface HistoryFilter {
  kind: HistoryKindFilter;
  /** A section label, or null for any section. */
  section: string | null;
  query: string;
}
