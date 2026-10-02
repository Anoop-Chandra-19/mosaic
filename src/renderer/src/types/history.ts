export type HistoryKindFilter = 'all' | 'named' | 'events';

export interface HistoryFilter {
  kind: HistoryKindFilter;
  /** A section label, or null for any section. */
  section: string | null;
  query: string;
}
