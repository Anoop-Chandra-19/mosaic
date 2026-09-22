import { parseBundle, type BundleParseResult } from '@shared/vault/parseBundle';
import { flushDraft } from '@/stores/resumeStore';
import type { BackupStatus } from '@shared/types/backup';
import type { MosaicBundle, OpenedBackup } from '@shared/types/bundle';
import { decodeText } from '@shared/types/files';

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

/**
 * Write every template, with its history, to a file the user picks. Resolves with the
 * backup status and the file's name, or null if they cancelled the Save dialog.
 */
export async function backUpNow(): Promise<{ status: BackupStatus; fileName: string } | null> {
  // The backup should hold the edits still waiting to be saved.
  await flushDraft();
  return window.mosaic.backup.backUpNow();
}

/** A chosen file Mosaic cannot restore; the message says why, for the user. */
export class UnreadableBackupError extends Error {}

function unreadable(fileName: string, result: Extract<BundleParseResult, { ok: false }>) {
  switch (result.code) {
    case 'invalid-json':
    case 'not-a-bundle':
      return `${fileName} isn’t a Mosaic backup`;
    case 'unsupported-version':
      return `${fileName} is from a newer Mosaic. Update Mosaic to restore it.`;
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
