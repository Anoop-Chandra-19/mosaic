import { readBackup } from '@/features/backup/backupFiles';
import type { OpenedBackup } from '@/types/bundle';
import { decodeText } from '@/types/files';
import { markdownToText } from './markdownToText';
import { parseResumeText, type ParsedResume } from './parseResume';

/** A file the Import dialog read: a resume to review, or a backup to hand to Restore. */
export type ImportRead =
  | { type: 'resume'; source: string; parsed: ParsedResume }
  | { type: 'backup'; backup: OpenedBackup };

/** A file Import can't read; the message says why, for the user. */
export class UnreadableFileError extends Error {}

function extensionOf(name: string): string {
  return name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
}

/**
 * Read a file for the Import dialog, whether picked or dropped. Throws an
 * `UnreadableFileError` (or, for a damaged backup, an `UnreadableBackupError`) when it
 * can't.
 */
export function readImportFile(name: string, bytes: Uint8Array): ImportRead {
  const extension = extensionOf(name);
  if (extension === 'json') {
    return { type: 'backup', backup: readBackup(name, decodeText(bytes)) };
  }
  if (extension === 'md' || extension === 'markdown') {
    return {
      type: 'resume',
      source: name,
      parsed: parseResumeText(markdownToText(decodeText(bytes))),
    };
  }
  if (extension === 'txt' || extension === 'text') {
    return { type: 'resume', source: name, parsed: parseResumeText(decodeText(bytes)) };
  }
  throw new UnreadableFileError(`Mosaic can’t read ${name} yet. Paste its text instead.`);
}
