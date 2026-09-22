import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Database } from 'better-sqlite3';
import type { BackupFrequency, BackupRecord, BackupStatus } from '@shared/types/backup';
import { BACKUP_FREQUENCIES } from '@shared/types/backup';
import { exportBundle } from '../db/bundle';
import { getSetting, removeSetting, setSetting } from '../db/settings';

/** The schedule, and when it last wrote a backup: main's alone, like every `app.` setting. */
const SCHEDULE_KEY = 'app.backupSchedule';
/** The most recent backup of either kind, for Settings to report. */
const LAST_BACKUP_KEY = 'app.lastBackup';
/** The last scheduled backup that failed, until one succeeds. */
const FAILURE_KEY = 'app.backupFailure';

interface BackupSchedule {
  frequency: BackupFrequency;
  folder: string | null;
  lastRunAt: number | null;
}

const OFF: BackupSchedule = { frequency: 'off', folder: null, lastRunAt: null };

function readJsonSetting(db: Database, key: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(getSetting(db, key) ?? 'null');
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const finiteOrNull = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

function readSchedule(db: Database): BackupSchedule {
  const stored = readJsonSetting(db, SCHEDULE_KEY);
  if (!stored) return OFF;
  const frequency = BACKUP_FREQUENCIES.find((f) => f === stored.frequency) ?? 'off';
  const folder = typeof stored.folder === 'string' ? stored.folder : null;
  return { frequency, folder, lastRunAt: finiteOrNull(stored.lastRunAt) };
}

function writeSchedule(db: Database, schedule: BackupSchedule): void {
  setSetting(db, SCHEDULE_KEY, JSON.stringify(schedule));
}

function readLastBackup(db: Database): BackupRecord | null {
  const stored = readJsonSetting(db, LAST_BACKUP_KEY);
  if (!stored) return null;
  const [at, templates, versions, bytes] = [
    stored.at,
    stored.templates,
    stored.versions,
    stored.bytes,
  ].map(finiteOrNull);
  if (at === null || templates === null || versions === null || bytes === null) return null;
  return { at, templates, versions, bytes };
}

function readFailure(db: Database): BackupStatus['failure'] {
  const stored = readJsonSetting(db, FAILURE_KEY);
  const at = finiteOrNull(stored?.at);
  return at !== null && typeof stored?.message === 'string'
    ? { at, message: stored.message }
    : null;
}

/** A folder as the user knows it: "~/Backups" rather than "/home/ada/Backups". */
function shortenFolder(folder: string): string {
  const home = os.homedir();
  if (process.platform === 'win32' || !folder.startsWith(home + path.sep)) return folder;
  return `~${folder.slice(home.length)}`;
}

export function readBackupStatus(db: Database): BackupStatus {
  const { frequency, folder } = readSchedule(db);
  return {
    frequency,
    folder: folder && shortenFolder(folder),
    last: readLastBackup(db),
    failure: readFailure(db),
  };
}

/** A frequency the renderer sent, checked; anything else is refused. */
export function parseBackupFrequency(value: unknown): BackupFrequency {
  const frequency = BACKUP_FREQUENCIES.find((f) => f === value);
  if (!frequency) throw new Error(`Unknown backup frequency ${String(value)}`);
  return frequency;
}

export function setBackupFrequency(db: Database, frequency: BackupFrequency): void {
  writeSchedule(db, { ...readSchedule(db), frequency });
}

export function hasBackupFolder(db: Database): boolean {
  return readSchedule(db).folder !== null;
}

/** A new folder starts its own run, so the next check writes into it straight away. */
export function setBackupFolder(db: Database, folder: string): void {
  writeSchedule(db, { ...readSchedule(db), folder, lastRunAt: null });
  removeSetting(db, FAILURE_KEY);
}

function formatDateDashed(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** A full backup's file name: "mosaic-backup-2026-09-22.json". */
export function buildBackupFileName(now: Date = new Date()): string {
  return `mosaic-backup-${formatDateDashed(now)}.json`;
}

/** Every template with its history, as the text of a backup file, and what it holds. */
export function writeBackupText(db: Database, now: number): { text: string; record: BackupRecord } {
  const bundle = exportBundle(db);
  // Indented, so the file reads as well as it restores.
  const text = JSON.stringify(bundle, null, 2);
  const record: BackupRecord = {
    at: now,
    templates: bundle.templates.length,
    versions: bundle.templates.reduce((sum, entry) => sum + entry.versions.length, 0),
    bytes: Buffer.byteLength(text),
  };
  return { text, record };
}

export function recordBackup(db: Database, record: BackupRecord): void {
  setSetting(db, LAST_BACKUP_KEY, JSON.stringify(record));
}

const DAY_MS = 24 * 60 * 60 * 1000;
const INTERVAL_DAYS: Record<Exclude<BackupFrequency, 'off'>, number> = { daily: 1, weekly: 7 };

/**
 * Calendar days from `from` to `to`: opening Mosaic a little earlier each morning still
 * counts as a new day.
 */
function daysBetween(from: number, to: number): number {
  const startOfDay = (ms: number) => new Date(ms).setHours(0, 0, 0, 0);
  return Math.round((startOfDay(to) - startOfDay(from)) / DAY_MS);
}

/**
 * The schedule wants a backup now: it is on, has a folder, and the last one it wrote is a
 * day (or a week) of calendar days behind. Nothing written yet counts as due.
 */
export function isBackupDue(
  schedule: { frequency: BackupFrequency; folder: string | null; lastRunAt: number | null },
  now: number
): boolean {
  if (schedule.frequency === 'off' || schedule.folder === null) return false;
  if (schedule.lastRunAt === null) return true;
  return daysBetween(schedule.lastRunAt, now) >= INTERVAL_DAYS[schedule.frequency];
}

/** Writes `text` under `fileName` in `folder`, or "-2", "-3"… beside a file already there. */
function writeNewFile(folder: string, fileName: string, text: string): string {
  const { name, ext } = path.parse(fileName);
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? fileName : `${name}-${n}${ext}`;
    try {
      fs.writeFileSync(path.join(folder, candidate), text, { flag: 'wx' });
      return candidate;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
  }
}

function describeFailure(error: unknown): string {
  switch ((error as NodeJS.ErrnoException).code) {
    case 'ENOENT':
      return 'The folder is gone. Choose another one.';
    case 'EACCES':
    case 'EPERM':
    case 'EROFS':
      return 'Mosaic isn’t allowed to write to the folder. Choose another one.';
    case 'ENOSPC':
      return 'The disk is full.';
    default:
      return 'The file could not be written.';
  }
}

/**
 * If a backup is due, write one into the schedule's folder. A failure is kept for Settings
 * to show, and the schedule stays due, so the next check tries again. With no templates
 * there is nothing to back up yet, and nothing is written.
 */
export function runScheduledBackup(db: Database, now: number = Date.now()): void {
  const schedule = readSchedule(db);
  if (!isBackupDue(schedule, now) || schedule.folder === null) return;
  const { text, record } = writeBackupText(db, now);
  if (record.templates === 0) return;
  try {
    writeNewFile(schedule.folder, buildBackupFileName(new Date(now)), text);
  } catch (error) {
    setSetting(db, FAILURE_KEY, JSON.stringify({ at: now, message: describeFailure(error) }));
    return;
  }
  writeSchedule(db, { ...schedule, lastRunAt: now });
  recordBackup(db, record);
  removeSetting(db, FAILURE_KEY);
}
