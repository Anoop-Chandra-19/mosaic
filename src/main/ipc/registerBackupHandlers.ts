import fs from 'node:fs/promises';
import path from 'node:path';
import { app, BrowserWindow, dialog, ipcMain, type IpcMainInvokeEvent } from 'electron';
import type { Database } from 'better-sqlite3';
import type { MosaicBackup } from '@shared/types/backup';
import { BACKUP_CHANNELS } from '@shared/ipc/appChannels';
import {
  buildBackupFileName,
  hasBackupFolder,
  parseBackupFrequency,
  readBackupStatus,
  recordBackup,
  runScheduledBackup,
  setBackupFolder,
  setBackupFrequency,
  writeBackupText,
} from '../backup/backupSchedule';

/** The first check waits for the app to settle; after that, once an hour. */
const FIRST_CHECK_MS = 60 * 1000;
const CHECK_EVERY_MS = 60 * 60 * 1000;

/**
 * Scheduled backups read the database as it stands. The draft's autosave lands a second
 * after typing stops (five at most), so only the last few keystrokes can be missing.
 */
function startBackupTimer(getDb: () => Database | undefined): void {
  const check = () => {
    const db = getDb();
    if (!db) return;
    try {
      runScheduledBackup(db);
    } catch (error) {
      console.error('Scheduled backup failed', error);
    }
  };
  setTimeout(() => {
    check();
    setInterval(check, CHECK_EVERY_MS);
  }, FIRST_CHECK_MS);
}

/** Answer the preload's `backup:*` calls, from the app's own page only, and run the schedule. */
export function registerBackupHandlers(
  getDb: () => Database | undefined,
  isAppFrame: (event: IpcMainInvokeEvent) => boolean
): void {
  const openDb = (): Database => {
    const db = getDb();
    if (!db) throw new Error('The database is not open');
    return db;
  };

  const chooseFolder = async (win: BrowserWindow): Promise<void> => {
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'Choose a folder for backups',
      properties: ['openDirectory', 'createDirectory'],
    });
    const [folder] = filePaths;
    if (canceled || !folder) return;
    setBackupFolder(openDb(), folder);
  };

  const handlers: {
    [K in keyof MosaicBackup]: (
      win: BrowserWindow,
      ...args: unknown[]
    ) => ReturnType<MosaicBackup[K]> | Awaited<ReturnType<MosaicBackup[K]>>;
  } = {
    status: () => readBackupStatus(openDb()),

    backUpNow: async (win) => {
      const db = openDb();
      const { canceled, filePath } = await dialog.showSaveDialog(win, {
        defaultPath: path.join(app.getPath('documents'), buildBackupFileName()),
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (canceled || !filePath) return null;
      const { text, record } = writeBackupText(db, Date.now());
      await fs.writeFile(filePath, text);
      recordBackup(db, record);
      return { status: readBackupStatus(db), fileName: path.basename(filePath) };
    },

    setFrequency: async (win, frequency) => {
      const next = parseBackupFrequency(frequency);
      if (next !== 'off' && !hasBackupFolder(openDb())) await chooseFolder(win);
      const db = openDb();
      if (next === 'off' || hasBackupFolder(db)) {
        setBackupFrequency(db, next);
        runScheduledBackup(db);
      }
      return readBackupStatus(db);
    },

    chooseFolder: async (win) => {
      await chooseFolder(win);
      const db = openDb();
      runScheduledBackup(db);
      return readBackupStatus(db);
    },
  };

  for (const [method, channel] of Object.entries(BACKUP_CHANNELS)) {
    const handler = handlers[method as keyof MosaicBackup] as (
      win: BrowserWindow,
      ...args: unknown[]
    ) => unknown;
    ipcMain.handle(channel, (event, ...args: unknown[]) => {
      const win = isAppFrame(event) ? BrowserWindow.fromWebContents(event.sender) : null;
      if (!win) throw new Error(`Refused ${channel} from ${event.senderFrame?.url}`);
      return handler(win, ...args);
    });
  }

  startBackupTimer(getDb);
}
