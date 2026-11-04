/**
 * File types supported by the system Open and Save dialogs. Main maps each type to
 * the dialog's file filter.
 */
export type FileType =
  | 'json'
  | 'markdown'
  | 'text'
  | 'pdf'
  | 'docx'
  /** Any supported resume format or backup file. */
  | 'import';

/**
 * Maximum PDF or Word file size in bytes. Prevents loading unexpectedly large files
 * into memory.
 */
export const MAX_FILE_BYTES = 128 * 1024 * 1024;

/**
 * Maximum text file size in bytes, including backups and JSON. Based on JavaScript's
 * maximum string length in UTF-16 code units; UTF-8 byte counts are at least as large.
 */
export const MAX_TEXT_BYTES = 2 ** 29 - 24;

export interface OpenedFile {
  /** The file's name, without its folder. */
  name: string;
  /** Raw file contents. The caller decodes text files. */
  bytes: Uint8Array;
}

/**
 * `window.mosaic.files` opens the system Save and Open dialogs. Main reads and writes
 * files only at paths the user selects in those dialogs.
 */
export interface MosaicFiles {
  /** Writes `content` where the user chooses. Resolves with the file's name, or null if cancelled. */
  save(type: FileType, suggestedName: string, content: string | Uint8Array): Promise<string | null>;
  /** Opens a file selected by the user. Returns null if cancelled. */
  open(type: FileType): Promise<OpenedFile | null>;
}

/** Decodes UTF-8 text and removes a leading byte-order mark, if present. */
export function decodeText(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}
