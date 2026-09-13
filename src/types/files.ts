/**
 * Kinds of file the app reads and writes through the system file dialogs. Each one sets
 * the dialog's file filter; main keeps the table.
 */
export type FileType =
  | 'json'
  | 'markdown'
  | 'text'
  | 'pdf'
  /** Anything the Import dialog can read: a resume as text, or a Mosaic backup. */
  | 'import';

/**
 * The most a file may hold. A backup of years of history is a few megabytes; this only
 * stops a runaway, or the wrong file, from being pulled into memory.
 */
export const MAX_FILE_BYTES = 128 * 1024 * 1024;

export interface OpenedTextFile {
  /** The file's name, without its folder. */
  name: string;
  text: string;
}

/**
 * `window.mosaic.files`: the system Save and Open dialogs. Main does the reading and
 * writing, and only ever at a path the user picked in the dialog.
 */
export interface MosaicFiles {
  /** Writes `content` where the user chooses. Resolves with the file's name, or null if cancelled. */
  save(type: FileType, suggestedName: string, content: string | Uint8Array): Promise<string | null>;
  /** One text file the user chooses, or null if cancelled. */
  openText(type: FileType): Promise<OpenedTextFile | null>;
}
