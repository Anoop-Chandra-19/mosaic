import fs from 'node:fs';
import { session } from 'electron';
import type { EraseResult, ForgetResult } from '@shared/types/secrets';

interface EraseSteps {
  /** Refuses key changes until the returned release is called. */
  holdKeyChanges: () => () => void;
  /** The assistant's run, which writes to the database, stopped with its end stored. */
  stopRuns: () => Promise<void>;
  /** API keys, from the keychain and from memory. */
  forgetKeys: () => Promise<ForgetResult>;
  /** The database file; its `-wal` and `-shm` companions go with it. */
  file: string;
  close: () => void;
  /** Opens a fresh, empty database at the same path. */
  reopen: () => void;
}

/**
 * Delete everything Mosaic keeps on this machine. Key changes are refused until it's done,
 * so a key saved meanwhile can't outlive it. The assistant's run stops first, so
 * nothing writes to the database as it goes. Then keys: if the keychain won't let one on
 * record go, the erase stops there with the resumes still intact, rather than leaving a key
 * behind an app that says it forgot everything. Entries with no record that the keychain
 * wouldn't delete are passed back, for Settings to say so. The database goes as a file, not
 * row by row, so nothing lingers in free pages or the WAL, and tables added later are
 * covered without anyone remembering to list them. Then whatever Chromium stored for the
 * page. The renderer reloads afterwards and boots into an empty app.
 */
export async function eraseAll({
  holdKeyChanges,
  stopRuns,
  forgetKeys,
  file,
  close,
  reopen,
}: EraseSteps): Promise<EraseResult> {
  const releaseKeyChanges = holdKeyChanges();
  try {
    await stopRuns();
    const { unconfirmed } = await forgetKeys();
    close();
    for (const suffix of ['', '-wal', '-shm']) fs.rmSync(file + suffix, { force: true });
    reopen();
    await session.defaultSession.clearStorageData();
    return { unconfirmedKeys: unconfirmed };
  } finally {
    releaseKeyChanges();
  }
}
