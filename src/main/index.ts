import fs from 'node:fs';
import path from 'node:path';
import { app, BrowserWindow, dialog, ipcMain, net } from 'electron';
import { ERASE_ALL } from '@shared/ipc/appChannels';
import { openDatabase, type Database } from './db/connection';
import { recoverInterruptedRuns } from './db/conversations/recoverInterruptedRuns';
import { chooseDatabaseFolder } from './db/databaseFolder';
import { API_KEYS_KEY, getSetting, setSetting } from './db/settings';
import { eraseAll } from './eraseAll';
import { registerBackupHandlers } from './ipc/registerBackupHandlers';
import { registerDbHandlers } from './ipc/registerDbHandlers';
import { registerFileHandlers } from './ipc/registerFileHandlers';
import { registerModelProviderHandlers } from './ipc/registerModelProviderHandlers';
import { registerSecretsHandlers } from './ipc/registerSecretsHandlers';
import { createSecretsHandlers } from './ipc/secretsHandlers';
import { testApiKey } from './model-providers/testApiKey';
import { createApiKeys } from './secrets/apiKeys';
import { osKeyring } from './secrets/osKeyring';
import { isAppFrame } from './window/appPage';
import { setAppMenu } from './window/appMenu';
import { createWindow } from './window/appWindow';

/*
 * Main's entry: the boot sequence. It points dev at its own profile, keeps to one instance,
 * opens the database, registers the IPC handlers (`ipc/`), and opens the window
 * (`window/`). It holds the database connection, which Erase closes and reopens.
 */

// Unpackaged runs (`bun run dev`, `preview`) keep their data in the repo's gitignored
// .dev-data/, apart from an installed Mosaic's; `bun run dev:reset` wipes it. An explicit
// --user-data-dir (the e2e tests) wins. Must run before the single-instance lock, which
// lives in the profile.
if (!app.isPackaged && !app.commandLine.hasSwitch('user-data-dir')) {
  app.setPath('userData', path.join(app.getAppPath(), '.dev-data'));
}

let db: Database | undefined;

const databaseFile = () =>
  path.join(
    chooseDatabaseFolder({
      platform: process.platform,
      env: process.env,
      homeDir: app.getPath('home'),
      appName: app.getName(),
      userDataDir: app.getPath('userData'),
      isUserDataRedirected: !app.isPackaged || app.commandLine.hasSwitch('user-data-dir'),
    }),
    'mosaic.db'
  );

function openAppDatabase(): Database {
  const file = databaseFile();
  // userData exists from launch; the local data folder may not yet.
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const opened = openDatabase(file, {
    // Dev stops on an edited migration (with a `dev:reset` hint); an installed build
    // warns and keeps going rather than lock anyone out of their resumes.
    tolerateEditedMigrations: app.isPackaged,
  });
  recoverInterruptedRuns(opened);
  return opened;
}

const openAppWindow = () => createWindow(db ? getSetting(db, 'ui') : null);

// One instance only: SQLite will have a single writer, and a second window over the
// same data would race it. A second launch focuses the existing window instead.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows();
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });

  void app.whenReady().then(() => {
    try {
      db = openAppDatabase();
    } catch (error) {
      // E.g. a database written by a newer Mosaic, or (dev) an edited migration: say so
      // rather than open an empty app.
      dialog.showErrorBox('Mosaic could not open its data', (error as Error).message);
      app.exit(1);
      return;
    }
    registerDbHandlers(() => db, isAppFrame);
    registerFileHandlers(isAppFrame);
    registerBackupHandlers(() => db, isAppFrame);
    registerModelProviderHandlers(isAppFrame);
    const apiKeys = createApiKeys(osKeyring(app.isPackaged ? 'Mosaic' : 'Mosaic (dev)'), {
      read: () => (db ? getSetting(db, API_KEYS_KEY) : null),
      write: (value) => {
        if (db) setSetting(db, API_KEYS_KEY, value);
      },
    });
    registerSecretsHandlers(
      createSecretsHandlers(apiKeys, (provider, key, model) =>
        testApiKey(provider, key, model, net.fetch)
      ),
      isAppFrame
    );
    ipcMain.handle(ERASE_ALL, (event) => {
      if (!isAppFrame(event)) throw new Error(`Refused erase from ${event.senderFrame?.url}`);
      return eraseAll({
        forgetKeys: () => apiKeys.forgetAll(),
        file: databaseFile(),
        close: () => {
          db?.close();
          db = undefined;
        },
        reopen: () => {
          db = openAppDatabase();
        },
      });
    });
    setAppMenu();
    openAppWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) openAppWindow();
    });
  });

  // A window holds its close until the renderer has saved (see flushBeforeClose), which
  // cancels a quit in progress; remember the quit so it still happens once windows close.
  let quitting = false;
  app.on('before-quit', () => {
    quitting = true;
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin' || quitting) app.quit();
  });

  // Closing the last connection checkpoints the WAL into mosaic.db and removes -wal/-shm.
  app.on('will-quit', () => {
    db?.close();
    db = undefined;
  });
}
