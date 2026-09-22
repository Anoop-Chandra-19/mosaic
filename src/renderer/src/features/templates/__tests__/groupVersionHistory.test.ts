import { describe, expect, it } from 'vitest';
import type { VersionMeta, VersionSource } from '@shared/types/db';
import {
  describeRunSections,
  formatTimeInDay,
  groupVersionHistory,
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
    parentId: null,
    kind,
    source,
    summary: `${source} ${seq}`,
    section: null,
    rev: seq,
    createdAt,
  };
}

/** Each group as its label, and each item as a version id or [ids of a run]. */
function shape(groups: HistoryGroup[]) {
  return groups.map((group) => [
    group.label,
    group.items.map((item) =>
      item.kind === 'run' ? item.versions.map((entry) => entry.version.id) : item.version.id
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

  it('holds four or more edits in a row as a run, and leaves fewer as rows', () => {
    seq = 0;
    const long = [0, 10, 20, 30].map((m) => version(at(22, 9, m)));
    const short = [0, 10, 20].map((m) => version(at(22, 14, m)));
    const groups = groupVersionHistory(newestFirst([...long, ...short]), { now: NOW });
    expect(shape(groups)).toEqual([['Today', ['v7', 'v6', 'v5', ['v4', 'v3', 'v2', 'v1']]]]);
  });

  it('breaks a run at a 45 minute gap, and at anything that is not plain editing', () => {
    seq = 0;
    const morning = [0, 10, 20, 30].map((m) => version(at(22, 8, m)));
    const later = [15, 25, 35].map((m) => version(at(22, 9, m)));
    const named = version(at(22, 9, 40), 'name', 'named');
    const after = [45, 50, 55, 58].map((m) => version(at(22, 9, m)));
    const stop = version(at(22, 10, 0), 'switched');
    const groups = groupVersionHistory(newestFirst([...morning, ...later, named, ...after, stop]), {
      now: NOW,
    });
    expect(shape(groups)).toEqual([
      [
        'Today',
        ['v13', ['v12', 'v11', 'v10', 'v9'], 'v8', 'v7', 'v6', 'v5', ['v4', 'v3', 'v2', 'v1']],
      ],
    ]);
  });

  it('keeps each version’s place in the whole history, for its label', () => {
    seq = 0;
    const versions = newestFirst([version(at(21, 9)), version(at(22, 9))]);
    const [today, yesterday] = groupVersionHistory(versions, { now: NOW });
    expect(today.items[0]).toMatchObject({ kind: 'version', index: 0 });
    expect(yesterday.items[0]).toMatchObject({ kind: 'version', index: 1 });
  });

  it('groups a filtered list by month, with no runs', () => {
    seq = 0;
    const versions = newestFirst([
      ...[0, 10, 20, 30].map((m) => version(at(22, 9, m))),
      version(new Date(2026, 7, 3).getTime()),
    ]);
    const groups = groupVersionHistory(versions, { now: NOW, byMonth: true });
    expect(groups.map((g) => [g.count, g.items.every((item) => item.kind === 'version')])).toEqual([
      [4, true],
      [1, true],
    ]);
    expect(groups[0].isToday).toBe(false);
  });
});

describe('describeRunSections', () => {
  const inSection = (section: string | null) => ({ ...version(NOW), section });

  it('names the one or two sections most of the run was in', () => {
    expect(describeRunSections([inSection('Projects'), inSection('Projects')])).toBe(
      'mostly Projects'
    );
    expect(
      describeRunSections([
        inSection('Skills'),
        inSection('Experience'),
        inSection('Experience'),
        inSection('Projects'),
        inSection('Projects'),
        inSection('Experience'),
        inSection(null),
      ])
    ).toBe('mostly Experience and Projects');
  });

  it('says across the document when no edit was in one section', () => {
    expect(describeRunSections([inSection(null), inSection(null)])).toBe('across the document');
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
