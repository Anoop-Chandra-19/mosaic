import fs from 'node:fs';
import { session } from 'electron';

interface EraseSteps {
  /** API keys, from the keychain and from memory. */
  forgetKeys: () => Promise<unknown>;
  /** The database file; its `-wal` and `-shm` companions go with it. */
  file: string;
  close: () => void;
  /** Opens a fresh, empty database at the same path. */
  reopen: () => void;
}

/**
 * Delete everything Mosaic keeps on this machine. Keys first: if the keychain won't let
 * one go, the erase stops there with the resumes still intact, rather than leaving a key
 * behind an app that says it forgot everything. The database goes as a file, not row by
 * row, so nothing lingers in free pages or the WAL, and tables added later are covered
 * without anyone remembering to list them. Then whatever Chromium stored for the page.
 * The renderer reloads afterwards and boots into an empty app.
 */
export async function eraseAll({ forgetKeys, file, close, reopen }: EraseSteps): Promise<void> {
  await forgetKeys();
  close();
  for (const suffix of ['', '-wal', '-shm']) fs.rmSync(file + suffix, { force: true });
  reopen();
  await session.defaultSession.clearStorageData();
}
