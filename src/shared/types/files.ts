/**
 * Kinds of file the app reads and writes through the system file dialogs. Each one sets
 * the dialog's file filter; main keeps the table.
 */
export type FileType =
  | 'json'
  | 'markdown'
  | 'text'
  | 'pdf'
  | 'docx'
  /** Anything the Import dialog can read: a resume in any format it knows, or a backup. */
  | 'import';

/**
 * The most a PDF or Word file may hold. It only stops the wrong file from being pulled into
 * memory; no resume comes close.
 */
export const MAX_FILE_BYTES = 128 * 1024 * 1024;

/**
 * The most a text file may hold and still be read: JavaScript's longest string, in UTF-16
 * units, which UTF-8 bytes never undercount. The only limit on backups and JSON.
 */
export const MAX_TEXT_BYTES = 2 ** 29 - 24;

export interface OpenedFile {
  /** The file's name, without its folder. */
  name: string;
  /** Its contents as they are on disk; text files are decoded by whoever reads them. */
  bytes: Uint8Array;
}

/**
 * `window.mosaic.files`: the system Save and Open dialogs. Main does the reading and
 * writing, and only ever at a path the user picked in the dialog.
 */
export interface MosaicFiles {
  /** Writes `content` where the user chooses. Resolves with the file's name, or null if cancelled. */
  save(type: FileType, suggestedName: string, content: string | Uint8Array): Promise<string | null>;
  /** One file the user chooses, or null if cancelled. */
  open(type: FileType): Promise<OpenedFile | null>;
}

/** A text file's contents: UTF-8, without a byte-order mark if it has one. */
export function decodeText(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}
