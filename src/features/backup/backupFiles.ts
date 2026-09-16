import { buildBackupFileName } from '@/lib/files/filename';
import { readSetting, writeSetting } from '@/lib/storage/settingsStorage';
import { getDb } from '@/lib/storage/mosaicDb';
import { isRecord } from '@/lib/resume/validateResume';
import { parseBundle, type BundleParseResult } from '@/lib/vault/parseBundle';
import { flushDraft } from '@/stores/resumeStore';
import type { MosaicBundle, OpenedBackup } from '@/types/bundle';
import { decodeText } from '@/types/files';

/** What a backup file holds, counted for the UI. */
export interface BundleCounts {
  templates: number;
  versions: number;
}

export function countBundle(bundle: MosaicBundle): BundleCounts {
  return {
    templates: bundle.templates.length,
    versions: bundle.templates.reduce((sum, entry) => sum + entry.versions.length, 0),
  };
}

/** The most recent backup made on this machine, for Settings to report. */
export interface BackupRecord extends BundleCounts {
  at: number;
  bytes: number;
}

const LAST_BACKUP_KEY = 'mosaic-last-backup';

export function readLastBackup(): BackupRecord | null {
  try {
    const stored: unknown = JSON.parse(readSetting(LAST_BACKUP_KEY) ?? 'null');
    if (!isRecord(stored)) return null;
    const { at, templates, versions, bytes } = stored;
    return [at, templates, versions, bytes].every(Number.isFinite)
      ? ({ at, templates, versions, bytes } as BackupRecord)
      : null;
  } catch {
    return null;
  }
}

/**
 * Write every template, with its history, to a file the user picks. Resolves with what was
 * written and the file's name, or null if they cancelled the Save dialog.
 */
export async function backUpNow(): Promise<{ record: BackupRecord; fileName: string } | null> {
  // The backup should hold the edits still waiting to be saved.
  await flushDraft();
  const bundle = await getDb().bundle.export();
  // Indented, so the file reads as well as it restores.
  const text = JSON.stringify(bundle, null, 2);
  const fileName = await window.mosaic.files.save('json', buildBackupFileName(), text);
  if (fileName === null) return null;

  const record: BackupRecord = {
    at: Date.now(),
    ...countBundle(bundle),
    bytes: new TextEncoder().encode(text).byteLength,
  };
  writeSetting(LAST_BACKUP_KEY, JSON.stringify(record));
  return { record, fileName };
}

/** A chosen file Mosaic cannot restore; the message says why, for the user. */
export class UnreadableBackupError extends Error {}

function unreadable(fileName: string, result: Extract<BundleParseResult, { ok: false }>) {
  switch (result.code) {
    case 'invalid-json':
    case 'not-a-bundle':
      return `${fileName} isn’t a Mosaic backup`;
    case 'unsupported-version':
      return `${fileName} is from a newer Mosaic — update Mosaic to restore it`;
    default:
      return `${fileName} is damaged and can’t be restored${result.detail ? `: ${result.detail}` : ''}`;
  }
}

/** Check a backup file's text; throws an `UnreadableBackupError` if Mosaic cannot restore it. */
export function readBackup(fileName: string, text: string): OpenedBackup {
  const parsed = parseBundle(text);
  if (!parsed.ok) throw new UnreadableBackupError(unreadable(fileName, parsed));
  return { fileName, text, bundle: parsed.bundle };
}

/**
 * Ask for a backup file and check it. Resolves with null if the user cancelled; rejects
 * with an `UnreadableBackupError` if the file is not one Mosaic can restore.
 */
export async function chooseBackup(): Promise<OpenedBackup | null> {
  const file = await window.mosaic.files.open('json');
  return file && readBackup(file.name, decodeText(file.bytes));
}

/** Say why a file could not be read: its own message if it has one the user should see. */
export function fileFailure(error: unknown, fallback: string): string {
  if (error instanceof UnreadableBackupError) return error.message;
  console.error(fallback, error);
  return fallback;
}
