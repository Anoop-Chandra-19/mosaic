/** Kinds of text file the app reads and writes through the system file dialogs. */
export type TextFileType = 'json';

/**
 * The most a text file may hold. A backup of years of history is a few megabytes; this
 * only stops a runaway, or the wrong file, from being pulled into memory.
 */
export const MAX_TEXT_FILE_BYTES = 128 * 1024 * 1024;

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
  /** Writes `text` where the user chooses. Resolves with the file's name, or null if cancelled. */
  saveText(type: TextFileType, suggestedName: string, text: string): Promise<string | null>;
  /** One file the user chooses, or null if cancelled. */
  openText(type: TextFileType): Promise<OpenedTextFile | null>;
}
