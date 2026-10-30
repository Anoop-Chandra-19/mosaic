import type { ProcessMemory } from '@shared/types/devTools';
import { devService } from '../devService';

export interface MemoryRow {
  name: string;
  isUtility: boolean;
  megabytes: number;
  /** Megabytes more (or fewer) than the last check; null when there was none to compare. */
  change: number | null;
}

export interface MemoryCheck {
  takenAt: Date;
  /** When the check it is compared with was taken. */
  since: Date | null;
  rows: MemoryRow[];
  total: MemoryRow;
}

interface TakenCheck {
  takenAt: Date;
  megabytes: Map<string, number>;
}

/** The one before, for the change since; kept for this session only. */
let lastCheck: TakenCheck | null = null;

const toMegabytes = (kilobytes: number) => Math.round(kilobytes / 1024);
const TOTAL_NAME = 'All of Mosaic';

function compareRow(
  name: string,
  isUtility: boolean,
  megabytes: number,
  before: TakenCheck | null
): MemoryRow {
  const earlier = before?.megabytes.get(name);
  return { name, isUtility, megabytes, change: earlier === undefined ? null : megabytes - earlier };
}

/** Sums processes that share a name, so each row is one name and compares with its own. */
function sumByName(processes: readonly ProcessMemory[]): ProcessMemory[] {
  const byName = new Map<string, ProcessMemory>();
  for (const process of processes) {
    const same = byName.get(process.name);
    byName.set(
      process.name,
      same ? { ...same, kilobytes: same.kilobytes + process.kilobytes } : process
    );
  }
  return [...byName.values()];
}

/** What each process holds now, and the change since the check before. */
export async function runMemoryCheck(): Promise<MemoryCheck> {
  const processes = sumByName(await devService.readMemory());
  const before = lastCheck;
  const rows = processes.map((process) =>
    compareRow(process.name, process.isUtility, toMegabytes(process.kilobytes), before)
  );
  const totalMegabytes = rows.reduce((sum, row) => sum + row.megabytes, 0);
  const total = compareRow(TOTAL_NAME, false, totalMegabytes, before);
  const takenAt = new Date();
  lastCheck = {
    takenAt,
    megabytes: new Map([...rows, total].map((row) => [row.name, row.megabytes])),
  };
  return { takenAt, since: before?.takenAt ?? null, rows, total };
}

/** "+4 MB", "−3 MB", "same"; nothing when there was no check before. */
export function formatMemoryChange(change: number | null): string {
  if (change === null) return '';
  if (change === 0) return 'same';
  return change > 0 ? `+${change} MB` : `−${-change} MB`;
}

/** "14:02:31": a clock time to the second, to tell checks apart. */
export const formatCheckTime = (date: Date) =>
  date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

/** The check as Copy as text writes it, columns lined up for a bug report. */
export function formatMemoryCheckText(check: MemoryCheck): string {
  const since = check.since ? `, change since ${formatCheckTime(check.since)}` : '';
  const rows = [...check.rows, check.total];
  const nameWidth = Math.max(...rows.map((row) => row.name.length));
  const lines = rows.map((row) =>
    [
      row.name.padEnd(nameWidth),
      `${row.megabytes} MB`.padStart(9),
      formatMemoryChange(row.change).padStart(9),
    ]
      .join('  ')
      .trimEnd()
  );
  return [`Memory check, per process: ${formatCheckTime(check.takenAt)}${since}`, ...lines].join(
    '\n'
  );
}
