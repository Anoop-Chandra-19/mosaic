import { describe, expect, it } from 'vitest';
import type { VersionMeta, VersionSource } from '@shared/types/db';
import {
  countFoldedByMonth,
  findFoldCutoff,
  formatTimeInDay,
  groupVersionHistory,
  listHistoryMonths,
  type HistoryGroup,
} from '../groupVersionHistory';

const at = (day: number, hour: number, minute = 0) =>
  new Date(2026, 8, day, hour, minute).getTime();
const NOW = at(22, 18);

let seq = 0;
function version(
  createdAt: number,
  source: VersionSource = 'edit',
  kind: VersionMeta['kind'] = 'auto'
): VersionMeta {
  seq += 1;
  return {
    id: `v${seq}`,
    templateId: 't',
    number: seq,
    revision: 0,
    parentId: null,
    kind,
    source,
    summary: `${source} ${seq}`,
    section: null,
    rev: seq,
    createdAt,
  };
}

/** The next revision of `previous`'s number. */
function revisionOf(previous: VersionMeta, createdAt: number, source: VersionSource = 'edit') {
  return {
    ...version(createdAt, source),
    id: `v${previous.number}.${previous.revision + 1}`,
    number: previous.number,
    revision: previous.revision + 1,
  };
}

/** Each group as its label, each number as a version id or [ids of its revisions], and {fold}. */
function shape(groups: HistoryGroup[]) {
  const numberShape = (revisions: VersionMeta[]) =>
    revisions.length === 1 ? revisions[0].id : revisions.map((version) => version.id);
  return groups.map((group) => [
    group.label,
    group.items.map((item) =>
      item.kind === 'number' ? numberShape(item.revisions) : { fold: item.numbers.map(numberShape) }
    ),
  ]);
}

/** Newest first, as the history lists them. */
const newestFirst = (versions: VersionMeta[]) =>
  [...versions].sort((a, b) => b.createdAt - a.createdAt);

describe('groupVersionHistory', () => {
  it('groups by day, newest first, counting each day and marking today', () => {
    seq = 0;
    const versions = newestFirst([
      version(at(20, 9), 'create'),
      version(at(21, 10), 'name', 'named'),
      version(at(22, 11), 'name', 'named'),
      version(at(22, 12), 'closed'),
    ]);
    const groups = groupVersionHistory(versions, { now: NOW });
    expect(groups.map((g) => [g.label, g.count, g.isToday])).toEqual([
      ['Today', 2, true],
      ['Yesterday', 1, false],
      [expect.stringContaining('20'), 1, false],
    ]);
  });

  it('holds a number’s revisions as one row, counted once, under the day of its newest', () => {
    seq = 0;
    const created = version(at(21, 9), 'create');
    const session = version(at(21, 23, 50));
    const first = revisionOf(session, at(22, 0, 10));
    const second = revisionOf(first, at(22, 0, 30), 'switched');
    const named = version(at(22, 9), 'name', 'named');
    const groups = groupVersionHistory(newestFirst([created, session, first, second, named]), {
      now: NOW,
    });
    expect(shape(groups)).toEqual([
      ['Today', ['v5', ['v2.2', 'v2.1', 'v2']]],
      ['Yesterday', ['v1']],
    ]);
    expect(groups.map((g) => g.count)).toEqual([2, 1]);
  });

  it('groups a filtered list by month, a row per number', () => {
    seq = 0;
    const versions = newestFirst([
      ...[0, 10, 20, 30].map((m) => version(at(22, 9, m))),
      version(new Date(2026, 7, 3).getTime()),
    ]);
    const groups = groupVersionHistory(versions, { now: NOW, byMonth: true });
    expect(groups.map((g) => [g.count, g.items.every((item) => item.kind === 'number')])).toEqual([
      [4, true],
      [1, true],
    ]);
    expect(groups[0].isToday).toBe(false);
  });

  it('past the fold age, goes by month and folds automatic snapshots between named ones', () => {
    seq = 0;
    const july = (day: number) => new Date(2026, 6, day, 10).getTime();
    const versions = newestFirst([
      version(july(2), 'create'),
      version(july(3)),
      version(july(4), 'closed'),
      version(july(5), 'name', 'named'),
      version(july(6)),
      version(july(7), 'import'),
      version(july(8), 'name', 'named'),
      // A lone one stays a row: a fold of one says less in the same height.
      version(july(9)),
      version(at(21, 9)),
    ]);
    const groups = groupVersionHistory(versions, {
      now: NOW,
      foldBefore: findFoldCutoff(30, NOW),
    });
    expect(shape(groups)).toEqual([
      ['Yesterday', ['v9']],
      ['Jul 2026', ['v8', 'v7', { fold: ['v6', 'v5'] }, 'v4', { fold: ['v3', 'v2', 'v1'] }]],
    ]);
    expect(groups.map((g) => g.isPastFold)).toEqual([false, true]);
    expect(countFoldedByMonth(groups)).toEqual(new Map([['Jul 2026', 5]]));
  });

  it('folds nothing when filtered, or when folding is off', () => {
    seq = 0;
    const versions = newestFirst([1, 2, 3].map((day) => version(new Date(2026, 6, day).getTime())));
    const foldBefore = findFoldCutoff(30, NOW);
    const isFolded = (groups: HistoryGroup[]) =>
      groups.some((group) => group.items.some((item) => item.kind === 'fold'));
    expect(isFolded(groupVersionHistory(versions, { now: NOW, byMonth: true, foldBefore }))).toBe(
      false
    );
    expect(
      isFolded(groupVersionHistory(versions, { now: NOW, foldBefore: findFoldCutoff(null) }))
    ).toBe(false);
    expect(isFolded(groupVersionHistory(versions, { now: NOW, foldBefore }))).toBe(true);
  });
});

describe('listHistoryMonths', () => {
  it('counts each month, newest first, and keeps its newest version to go to', () => {
    seq = 0;
    const versions = newestFirst([
      version(new Date(2026, 6, 1).getTime()),
      version(new Date(2026, 6, 30).getTime()),
      version(at(2, 9)),
      version(at(20, 9)),
    ]);
    expect(listHistoryMonths(versions).map((m) => [m.count, m.newest.id])).toEqual([
      [2, 'v4'],
      [2, 'v2'],
    ]);
  });
});

describe('formatTimeInDay', () => {
  it('counts back today, and gives the time of day before today', () => {
    expect(formatTimeInDay(NOW - 20_000, NOW)).toBe('just now');
    expect(formatTimeInDay(NOW - 12 * 60_000, NOW)).toBe('12 min ago');
    expect(formatTimeInDay(at(22, 9), NOW)).toBe('9h ago');
    expect(formatTimeInDay(at(21, 21, 12), NOW)).toMatch(/9:12/);
  });
});
