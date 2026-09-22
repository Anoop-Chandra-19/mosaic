import type { VersionMeta } from '@shared/types/db';

export type HistoryKindFilter = 'all' | 'named' | 'events';

export interface HistoryFilter {
  kind: HistoryKindFilter;
  /** A section label, or null for any section. */
  section: string | null;
  query: string;
}

export const NO_HISTORY_FILTER: HistoryFilter = { kind: 'all', section: null, query: '' };

export function isHistoryFiltered(filter: HistoryFilter): boolean {
  return filter.kind !== 'all' || filter.section !== null || filter.query.trim() !== '';
}

/** Anything but plain editing: named versions, imports, restores, where you left off. */
export function isHistoryEvent(version: VersionMeta): boolean {
  return version.kind === 'named' || version.source !== 'edit';
}

export function filterVersionHistory(
  versions: VersionMeta[],
  filter: HistoryFilter
): VersionMeta[] {
  const query = filter.query.trim().toLocaleLowerCase();
  return versions.filter(
    (version) =>
      (filter.kind !== 'named' || version.kind === 'named') &&
      (filter.kind !== 'events' || isHistoryEvent(version)) &&
      (filter.section === null || version.section === filter.section) &&
      (query === '' || version.summary.toLocaleLowerCase().includes(query))
  );
}

/** The sections this history's edits were in, alphabetically: the section menu's choices. */
export function listHistorySections(versions: VersionMeta[]): string[] {
  const sections = new Set<string>();
  for (const { section } of versions) if (section !== null) sections.add(section);
  return [...sections].sort((a, b) => a.localeCompare(b));
}
