import type { VersionMeta } from '@shared/types/db';

const MINUTE = 60_000;
/** A gap this long ends a run of editing. */
export const SESSION_GAP_MS = 45 * MINUTE;
/** Fewer rows than this and collapsing a run hides more than it saves. */
export const SESSION_MIN_ROWS = 4;

/** A version and its place in the whole history, which its label is counted from. */
export interface IndexedVersion {
  version: VersionMeta;
  index: number;
}

export type HistoryItem =
  | ({ kind: 'version' } & IndexedVersion)
  | { kind: 'run'; versions: IndexedVersion[] };

export interface HistoryGroup {
  /** The day's (or month's) first moment. */
  key: number;
  label: string;
  isToday: boolean;
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

export function formatHistoryDay(ms: number, now: number): string {
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

/**
 * The history, newest first, as days, and inside a day the runs of plain editing that can
 * be held as one row. A filtered list is sparse, so `byMonth` groups by month and holds no
 * runs: one row under each date header would read as a header per row.
 */
export function groupVersionHistory(
  versions: VersionMeta[],
  { now = Date.now(), byMonth = false }: { now?: number; byMonth?: boolean } = {}
): HistoryGroup[] {
  const groups: HistoryGroup[] = [];
  versions.forEach((version, index) => {
    const at = version.createdAt;
    const key = byMonth ? startOfMonth(at) : startOfDay(at);
    let group = groups.at(-1);
    if (!group || group.key !== key) {
      group = {
        key,
        label: byMonth ? formatHistoryMonth(at) : formatHistoryDay(at, now),
        isToday: !byMonth && key === startOfDay(now),
        count: 0,
        items: [],
      };
      groups.push(group);
    }
    group.count += 1;

    const last = group.items.at(-1);
    if (byMonth || !isPlainEdit(version)) {
      group.items.push({ kind: 'version', version, index });
    } else if (
      last?.kind === 'run' &&
      last.versions.at(-1)!.version.createdAt - at < SESSION_GAP_MS
    ) {
      last.versions.push({ version, index });
    } else {
      group.items.push({ kind: 'run', versions: [{ version, index }] });
    }
  });

  for (const group of groups) {
    group.items = group.items.flatMap((item) =>
      item.kind === 'run' && item.versions.length < SESSION_MIN_ROWS
        ? item.versions.map((entry): HistoryItem => ({ kind: 'version', ...entry }))
        : [item]
    );
  }
  return groups;
}
