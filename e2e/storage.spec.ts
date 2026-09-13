import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { expect, test } from '@playwright/test';
import { launchApp } from './launch';

test('opens its database in the profile and closes it cleanly on quit', async () => {
  const { app, userDataDir } = await launchApp();
  try {
    const file = path.join(userDataDir, 'mosaic.db');
    expect(fs.existsSync(file)).toBe(true);

    await app.close();

    // A clean close checkpoints the WAL: no -wal/-shm left beside the database.
    expect(fs.readdirSync(userDataDir).filter((name) => name.startsWith('mosaic.db'))).toEqual([
      'mosaic.db',
    ]);
    const db = new Database(file, { readonly: true });
    try {
      expect(db.pragma('user_version', { simple: true })).toBe(1);
    } finally {
      db.close();
    }
  } finally {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
});
