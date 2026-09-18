import { readBackup } from '@/features/backup/backupFiles';
import { isRecord } from '@shared/resume/validateResume';
import type { OpenedBackup } from '@shared/types/bundle';
import { decodeText } from '@shared/types/files';
import { parseResumeText, type ParsedResume } from './parseResume';
import { NotADocxError, readDocx } from './docx/readDocx';
import { isJsonResume, readJsonResume } from './readJsonResume';
import { readMarkdown } from './readMarkdown';
import { XmlError, XmlLimitError } from './docx/parseXml';
import { ZipError, ZipLimitError } from './docx/openZip';
import {
  NotAPdfError,
  PdfHasNoTextError,
  PdfLimitError,
  PdfPasswordError,
  readPdf,
} from './pdf/readPdf';

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
 * The first bytes of a Microsoft compound file: a Word 97–2003 document, or a .docx locked
 * with a password, which Word wraps in one.
 */
const COMPOUND_FILE = [0xd0, 0xcf, 0x11, 0xe0];

const isCompoundFile = (bytes: Uint8Array) => COMPOUND_FILE.every((byte, i) => bytes[i] === byte);

/** Where a locked .docx keeps the document: a stream with this name, in UTF-16. */
const ENCRYPTED_PACKAGE = new Uint8Array(
  [...'EncryptedPackage'].flatMap((char) => [char.charCodeAt(0), 0])
);

function contains(bytes: Uint8Array, part: Uint8Array): boolean {
  outer: for (let at = bytes.indexOf(part[0]); at >= 0; at = bytes.indexOf(part[0], at + 1)) {
    for (let i = 1; i < part.length; i++) if (bytes[at + i] !== part[i]) continue outer;
    return true;
  }
  return false;
}

const olderWord = (name: string) =>
  new UnreadableFileError(`${name} is an older Word document. Save it as .docx and try again.`);

async function readWord(name: string, bytes: Uint8Array): Promise<ImportRead> {
  if (isCompoundFile(bytes)) {
    if (!contains(bytes, ENCRYPTED_PACKAGE)) throw olderWord(name);
    throw new UnreadableFileError(
      `${name} is locked with a password. Save an unlocked copy and try again.`
    );
  }
  try {
    return { type: 'resume', source: name, parsed: await readDocx(bytes) };
  } catch (error) {
    // Too much to read is a different answer from not being a Word file at all.
    if (error instanceof ZipLimitError || error instanceof XmlLimitError) {
      throw new UnreadableFileError(`${name} is larger or more complex than Mosaic can read.`);
    }
    if (error instanceof ZipError || error instanceof XmlError || error instanceof NotADocxError) {
      throw new UnreadableFileError(`${name} isn’t a Word document Mosaic can read.`);
    }
    throw error;
  }
}

async function readPdfFile(name: string, bytes: Uint8Array): Promise<ImportRead> {
  try {
    return { type: 'resume', source: name, parsed: await readPdf(bytes) };
  } catch (error) {
    if (error instanceof PdfPasswordError) {
      throw new UnreadableFileError(
        `${name} is locked with a password. Save an unlocked copy and try again.`
      );
    }
    if (error instanceof PdfHasNoTextError) {
      throw new UnreadableFileError(
        `${name} has no text in it — it’s probably a scan. Paste the text instead.`
      );
    }
    if (error instanceof PdfLimitError) {
      throw new UnreadableFileError(`${name} is larger or more complex than Mosaic can read.`);
    }
    if (error instanceof NotAPdfError) {
      throw new UnreadableFileError(`${name} isn’t a PDF Mosaic can read.`);
    }
    throw error;
  }
}

/**
 * Read a file for the Import dialog, whether picked or dropped. Throws an
 * `UnreadableFileError` (or, for a damaged backup, an `UnreadableBackupError`) when it
 * can't.
 */
export async function readImportFile(name: string, bytes: Uint8Array): Promise<ImportRead> {
  const extension = extensionOf(name);
  if (extension === 'json') return readJson(name, bytes);
  if (extension === 'pdf') return readPdfFile(name, bytes);
  if (extension === 'docx') return readWord(name, bytes);
  if (extension === 'doc') throw olderWord(name);
  if (extension === 'md' || extension === 'markdown') {
    return { type: 'resume', source: name, parsed: readMarkdown(decodeText(bytes)) };
  }
  if (extension === 'txt' || extension === 'text') {
    return { type: 'resume', source: name, parsed: parseResumeText(decodeText(bytes)) };
  }
  throw new UnreadableFileError(`Mosaic can’t read ${name} yet. Paste its text instead.`);
}
