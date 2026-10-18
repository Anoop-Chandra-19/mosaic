import fs from 'node:fs';
import path from 'node:path';
import { app, dialog } from 'electron';
import { isUserDataRedirected } from '../devProfile';
import { openDatabase, type Database } from './connection';
import { recoverInterruptedRuns } from './conversations/recoverInterruptedRuns';
import { chooseDatabaseFolder } from './databaseFolder';

// Main's one connection to mosaic.db. Opened at launch, closed and reopened by Erase, and
// closed on quit; everything else asks for it with `getAppDatabase`.

let db: Database | undefined;

export function getAppDatabase(): Database | undefined {
  return db;
}

export function databaseFile(): string {
  const folder = chooseDatabaseFolder({
    platform: process.platform,
    env: process.env,
    homeDir: app.getPath('home'),
    appName: app.getName(),
    userDataDir: app.getPath('userData'),
    isUserDataRedirected: isUserDataRedirected(),
  });
  return path.join(folder, 'mosaic.db');
}

export function openAppDatabase(): void {
  const file = databaseFile();
  // userData exists from launch; the local data folder may not yet.
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const opened = openDatabase(file, {
    // Dev stops on an edited migration (with a `dev:reset` hint); an installed build
    // warns and keeps going rather than lock anyone out of their resumes.
    tolerateEditedMigrations: app.isPackaged,
  });
  recoverInterruptedRuns(opened);
  db = opened;
}

/**
 * At launch. A database that won't open (one written by a newer Mosaic, or in dev an
 * edited migration) is said, and the app quits rather than open empty. False if it quit.
 */
export function openAppDatabaseOrQuit(): boolean {
  try {
    openAppDatabase();
    return true;
  } catch (error) {
    dialog.showErrorBox('Mosaic could not open its data', (error as Error).message);
    app.exit(1);
    return false;
  }
}

/** Closing the last connection checkpoints the WAL into mosaic.db and removes -wal/-shm. */
export function closeAppDatabase(): void {
  db?.close();
  db = undefined;
}
