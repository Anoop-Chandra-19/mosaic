export type HistoryKindFilter = 'all' | 'named' | 'events';

/** What a version is read against: the version before it, or the draft. */
export type HistoryComparison = 'parent' | 'draft';

export interface HistoryFilter {
  kind: HistoryKindFilter;
  /** A section label, or null for any section. */
  section: string | null;
  query: string;
}
