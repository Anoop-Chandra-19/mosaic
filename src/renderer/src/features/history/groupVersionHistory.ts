import type { VersionMeta } from '@shared/types/db';

const MINUTE = 60_000;
/** A gap this long ends a run of editing. */
export const SESSION_GAP_MS = 45 * MINUTE;
/** Fewer rows than this and collapsing a run hides more than it saves. */
export const SESSION_MIN_ROWS = 4;

/** Fewer rows than this past the fold age stay plain: a fold would be as tall and say less. */
export const FOLD_MIN_ROWS = 2;

export type HistoryItem =
  | { kind: 'version'; version: VersionMeta }
  /** Plain editing held as one row. */
  | { kind: 'run'; versions: VersionMeta[] }
  /** Automatic snapshots past the fold age, between two named versions. */
  | { kind: 'fold'; versions: VersionMeta[] };

export interface HistoryGroup {
  /** The day's (or month's) first moment. */
  key: number;
  label: string;
  isToday: boolean;
  /** Past the fold age: a month whose automatic snapshots fold. */
  isPastFold: boolean;
  count: number;
  items: HistoryItem[];
}

/** The only rows a run may hold. Named versions, imports, restores and stops break a run. */
export function isPlainEdit(version: VersionMeta): boolean {
  return version.kind === 'auto' && version.source === 'edit';
}

function startOfDay(ms: number): number {
  return new Date(ms).setHours(0, 0, 0, 0);
}

function startOfMonth(ms: number): number {
  const date = new Date(ms);
  date.setDate(1);
  return date.setHours(0, 0, 0, 0);
}

export function formatHistoryDay(ms: number, now: number = Date.now()): string {
  const today = startOfDay(now);
  const day = startOfDay(ms);
  if (day === today) return 'Today';
  if (day === startOfDay(today - 1)) return 'Yesterday';
  const sameYear = new Date(ms).getFullYear() === new Date(now).getFullYear();
  return new Date(ms).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

export function formatHistoryMonth(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

export function formatTimeOfDay(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** A row's time under its day's header: "12 min ago" or "3h ago" today, "9:12 PM" before. */
export function formatTimeInDay(ms: number, now: number = Date.now()): string {
  const ago = now - ms;
  if (ago < MINUTE) return 'just now';
  if (ms >= startOfDay(now)) {
    return ago < 60 * MINUTE
      ? `${Math.floor(ago / MINUTE)} min ago`
      : `${Math.floor(ago / (60 * MINUTE))}h ago`;
  }
  return formatTimeOfDay(ms);
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
    const label = formatHistoryMonth(version.createdAt);
    const last = months.at(-1);
    if (last?.label === label) last.count += 1;
    else months.push({ label, newest: version, count: 1 });
  }
  return months;
}

/** Where a run's edits happened: "mostly Experience and Projects", or "across the document". */
export function describeRunSections(versions: VersionMeta[]): string {
  const tally = new Map<string, number>();
  for (const { section } of versions) {
    if (section !== null) tally.set(section, (tally.get(section) ?? 0) + 1);
  }
  const top = [...tally.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([section]) => section);
  return top.length === 0 ? 'across the document' : `mostly ${top.join(' and ')}`;
}

/** The moment before which automatic snapshots fold: the start of the day `days` ago. */
export function findFoldCutoff(days: number | null, now: number = Date.now()): number {
  return days === null ? -Infinity : startOfDay(now) - days * 24 * 60 * MINUTE;
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
    label: isMonth ? formatHistoryMonth(at) : formatHistoryDay(at, now),
    isToday: !isMonth && key === startOfDay(now),
    isPastFold,
    count: 0,
    items: [],
  };
}

/** Where a version goes in its group: into the run or fold before it, or a row of its own. */
function placeVersion(group: HistoryGroup, version: VersionMeta, isFiltered: boolean): void {
  const last = group.items.at(-1);
  if (group.isPastFold && version.kind === 'auto') {
    if (last?.kind === 'fold') last.versions.push(version);
    else group.items.push({ kind: 'fold', versions: [version] });
  } else if (isFiltered || group.isPastFold || !isPlainEdit(version)) {
    group.items.push({ kind: 'version', version });
  } else if (
    last?.kind === 'run' &&
    last.versions.at(-1)!.createdAt - version.createdAt < SESSION_GAP_MS
  ) {
    last.versions.push(version);
  } else {
    group.items.push({ kind: 'run', versions: [version] });
  }
}

const MIN_HELD_ROWS: Record<'run' | 'fold', number> = {
  run: SESSION_MIN_ROWS,
  fold: FOLD_MIN_ROWS,
};

/** Runs and folds too short to be worth holding go back to plain rows. */
function unholdShortItems(items: HistoryItem[]): HistoryItem[] {
  return items.flatMap((item) =>
    item.kind !== 'version' && item.versions.length < MIN_HELD_ROWS[item.kind]
      ? item.versions.map((version): HistoryItem => ({ kind: 'version', version }))
      : [item]
  );
}

/**
 * The history, newest first, as days, and inside a day the runs of plain editing that can
 * be held as one row. Past the fold age it goes by month, and the automatic snapshots
 * between two named versions fold into one row; nothing is deleted. A filtered list is
 * sparse, so `byMonth` groups by month and holds nothing: one row under each date header
 * would read as a header per row.
 */
export function groupVersionHistory(
  versions: VersionMeta[],
  { now = Date.now(), byMonth = false, foldBefore = -Infinity }: GroupOptions = {}
): HistoryGroup[] {
  const groups: HistoryGroup[] = [];
  for (const version of versions) {
    const at = version.createdAt;
    const isPastFold = !byMonth && at < foldBefore;
    const isMonth = byMonth || isPastFold;
    const key = isMonth ? startOfMonth(at) : startOfDay(at);
    let group = groups.at(-1);
    if (!group || group.key !== key || group.isPastFold !== isPastFold) {
      group = startGroup(at, isMonth, isPastFold, now);
      groups.push(group);
    }
    group.count += 1;
    placeVersion(group, version, byMonth);
  }

  for (const group of groups) group.items = unholdShortItems(group.items);
  return groups;
}

/** How many versions sit inside a fold, by month label. Lone rows past the age don't. */
export function countFoldedByMonth(groups: HistoryGroup[]): Map<string, number> {
  const folded = new Map<string, number>();
  for (const group of groups) {
    for (const item of group.items) {
      if (item.kind === 'fold') {
        folded.set(group.label, (folded.get(group.label) ?? 0) + item.versions.length);
      }
    }
  }
  return folded;
}
