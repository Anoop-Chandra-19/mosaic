import { readBackup } from '@/features/backup/backupFiles';
import { isRecord } from '@/lib/resume/validateResume';
import type { OpenedBackup } from '@/types/bundle';
import { decodeText } from '@/types/files';
import { parseResumeText, type ParsedResume } from './parseResume';
import { isJsonResume, readJsonResume } from './readJsonResume';
import { readMarkdown } from './readMarkdown';

/** A file the Import dialog read: a resume to review, or a backup to hand to Restore. */
export type ImportRead =
  | { type: 'resume'; source: string; parsed: ParsedResume }
  | { type: 'backup'; backup: OpenedBackup };

/** A file Import can't read; the message says why, for the user. */
export class UnreadableFileError extends Error {}

function extensionOf(name: string): string {
  return name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
}

/** A JSON file is either a JSON Resume to review or a Mosaic backup to restore. */
function readJson(name: string, bytes: Uint8Array): ImportRead {
  const text = decodeText(bytes);
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    value = undefined;
  }
  if (isJsonResume(value)) return { type: 'resume', source: name, parsed: readJsonResume(value) };
  if (isRecord(value) && 'bundleVersion' in value) {
    return { type: 'backup', backup: readBackup(name, text) };
  }
  throw new UnreadableFileError(`${name} isn’t a resume or a Mosaic backup.`);
}

/**
 * Read a file for the Import dialog, whether picked or dropped. Throws an
 * `UnreadableFileError` (or, for a damaged backup, an `UnreadableBackupError`) when it
 * can't.
 */
export function readImportFile(name: string, bytes: Uint8Array): ImportRead {
  const extension = extensionOf(name);
  if (extension === 'json') return readJson(name, bytes);
  if (extension === 'md' || extension === 'markdown') {
    return { type: 'resume', source: name, parsed: readMarkdown(decodeText(bytes)) };
  }
  if (extension === 'txt' || extension === 'text') {
    return { type: 'resume', source: name, parsed: parseResumeText(decodeText(bytes)) };
  }
  throw new UnreadableFileError(`Mosaic can’t read ${name} yet. Paste its text instead.`);
}
