import { DAY, startOfDay, startOfMonth } from '@shared/time/calendar';
import { formatDay, formatMonth } from '@shared/time/formatTime';
import type { VersionMeta } from '@shared/types/db';

/** Fewer rows than this past the fold age stay plain: a fold would be as tall and say less. */
export const FOLD_MIN_ROWS = 2;

export type HistoryItem =
  /** A version number: its newest revision is the row, the earlier ones open under it. */
  | { kind: 'number'; revisions: VersionMeta[] }
  /** Automatic numbers past the fold age, between two named versions. */
  | { kind: 'fold'; numbers: VersionMeta[][] };

export interface HistoryGroup {
  /** The day's (or month's) first moment. */
  key: number;
  label: string;
  isToday: boolean;
  /** Past the fold age: a month whose automatic snapshots fold. */
  isPastFold: boolean;
  /** Rows as the list draws them: a number with its revisions is one. */
  count: number;
  items: HistoryItem[];
}

/** The history, newest first, as version numbers, each with its revisions newest first. */
export function groupRevisions(versions: VersionMeta[]): VersionMeta[][] {
  const numbers: VersionMeta[][] = [];
  for (const version of versions) {
    const last = numbers.at(-1);
    if (last?.[0].number === version.number) last.push(version);
    else numbers.push([version]);
  }
  return numbers;
}

export interface HistoryMonthSummary {
  label: string;
  newest: VersionMeta;
  count: number;
}

/** Each month the history reaches, newest first, with its count and its newest version. */
export function listHistoryMonths(versions: VersionMeta[]): HistoryMonthSummary[] {
  const months: HistoryMonthSummary[] = [];
  for (const version of versions) {
    const label = formatMonth(version.createdAt);
    const last = months.at(-1);
    if (last?.label === label) last.count += 1;
    else months.push({ label, newest: version, count: 1 });
  }
  return months;
}

/** The moment before which automatic snapshots fold: the start of the day `days` ago. */
export function findFoldCutoff(days: number | null, now: number = Date.now()): number {
  return days === null ? -Infinity : startOfDay(now) - days * DAY;
}

interface GroupOptions {
  now?: number;
  /** A filtered list: by month, and nothing held or folded, so no match is hidden. */
  byMonth?: boolean;
  /** Automatic snapshots taken before this fold, by month (`findFoldCutoff`). */
  foldBefore?: number;
}

function startGroup(at: number, isMonth: boolean, isPastFold: boolean, now: number): HistoryGroup {
  const key = isMonth ? startOfMonth(at) : startOfDay(at);
  return {
    key,
    label: isMonth ? formatMonth(at) : formatDay(at, now),
    isToday: !isMonth && key === startOfDay(now),
    isPastFold,
    count: 0,
    items: [],
  };
}

/** Where a number goes in its group: into the fold before it, or a row of its own. */
function placeNumber(group: HistoryGroup, revisions: VersionMeta[]): void {
  const last = group.items.at(-1);
  if (!group.isPastFold || revisions[0].kind !== 'auto') {
    group.items.push({ kind: 'number', revisions });
  } else if (last?.kind === 'fold') {
    last.numbers.push(revisions);
  } else {
    group.items.push({ kind: 'fold', numbers: [revisions] });
  }
}

/** Folds too short to be worth holding go back to plain rows. */
function unholdShortFolds(items: HistoryItem[]): HistoryItem[] {
  return items.flatMap((item) =>
    item.kind === 'fold' && item.numbers.length < FOLD_MIN_ROWS
      ? item.numbers.map((revisions): HistoryItem => ({ kind: 'number', revisions }))
      : [item]
  );
}

/**
 * The history, newest first, as days of version numbers, each number one row with its
 * revisions under it. Past the fold age it goes by month, and the automatic numbers
 * between two named versions fold into one row; nothing is deleted. A filtered list is
 * sparse, so `byMonth` groups by month and folds nothing: one row under each date header
 * would read as a header per row.
 */
export function groupVersionHistory(
  versions: VersionMeta[],
  { now = Date.now(), byMonth = false, foldBefore = -Infinity }: GroupOptions = {}
): HistoryGroup[] {
  const groups: HistoryGroup[] = [];
  for (const revisions of groupRevisions(versions)) {
    const at = revisions[0].createdAt;
    const isPastFold = !byMonth && at < foldBefore;
    const isMonth = byMonth || isPastFold;
    const key = isMonth ? startOfMonth(at) : startOfDay(at);
    let group = groups.at(-1);
    if (!group || group.key !== key || group.isPastFold !== isPastFold) {
      group = startGroup(at, isMonth, isPastFold, now);
      groups.push(group);
    }
    group.count += 1;
    placeNumber(group, revisions);
  }

  for (const group of groups) group.items = unholdShortFolds(group.items);
  return groups;
}

/** How many numbers sit inside a fold, by month label. Lone rows past the age don't. */
export function countFoldedByMonth(groups: HistoryGroup[]): Map<string, number> {
  const folded = new Map<string, number>();
  for (const group of groups) {
    for (const item of group.items) {
      if (item.kind === 'fold') {
        folded.set(group.label, (folded.get(group.label) ?? 0) + item.numbers.length);
      }
    }
  }
  return folded;
}
