import { describe, expect, it } from 'vitest';
import type { VersionMeta, VersionSource } from '@shared/types/db';
import {
  filterVersionHistory,
  isHistoryFiltered,
  listHistorySections,
  NO_HISTORY_FILTER,
} from '../filterVersionHistory';

function version(
  id: string,
  summary: string,
  { source = 'edit', section = null }: { source?: VersionSource; section?: string | null } = {}
): VersionMeta {
  return {
    id,
    templateId: 't',
    parentId: null,
    kind: source === 'name' ? 'named' : 'auto',
    source,
    summary,
    section,
    rev: 0,
    createdAt: 0,
  };
}

const HISTORY = [
  version('v6', 'Sent to Northwind', { source: 'name' }),
  version('v5', 'Edited a bullet in Open Source', { section: 'Open Source' }),
  version('v4', 'Where you left it', { source: 'closed' }),
  version('v3', 'Edited 2 bullets in Experience', { section: 'Experience' }),
  version('v2', 'Imported from resume.pdf', { source: 'import' }),
  version('v1', 'Created', { source: 'create' }),
];

const ids = (versions: VersionMeta[]) => versions.map((v) => v.id);

describe('filterVersionHistory', () => {
  it('keeps only named versions, or only events', () => {
    expect(ids(filterVersionHistory(HISTORY, { ...NO_HISTORY_FILTER, kind: 'named' }))).toEqual([
      'v6',
    ]);
    expect(ids(filterVersionHistory(HISTORY, { ...NO_HISTORY_FILTER, kind: 'events' }))).toEqual([
      'v6',
      'v4',
      'v2',
      'v1',
    ]);
  });

  it('matches the stored section, not the words of the summary', () => {
    expect(
      ids(filterVersionHistory(HISTORY, { ...NO_HISTORY_FILTER, section: 'Open Source' }))
    ).toEqual(['v5']);
  });

  it('searches summaries whatever their case, and ignores surrounding spaces', () => {
    expect(
      ids(filterVersionHistory(HISTORY, { ...NO_HISTORY_FILTER, query: ' northWIND ' }))
    ).toEqual(['v6']);
  });

  it('applies every part of the filter together', () => {
    expect(
      filterVersionHistory(HISTORY, { kind: 'named', section: 'Experience', query: '' })
    ).toEqual([]);
  });
});

describe('isHistoryFiltered', () => {
  it('counts a query of only spaces as no filter', () => {
    expect(isHistoryFiltered({ ...NO_HISTORY_FILTER, query: '  ' })).toBe(false);
    expect(isHistoryFiltered({ ...NO_HISTORY_FILTER, kind: 'events' })).toBe(true);
  });
});

describe('listHistorySections', () => {
  it('lists each section once, alphabetically', () => {
    expect(listHistorySections([...HISTORY, HISTORY[1]])).toEqual(['Experience', 'Open Source']);
  });
});
