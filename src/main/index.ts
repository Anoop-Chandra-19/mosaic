import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeTheme,
  net,
  screen,
  shell,
  type IpcMainInvokeEvent,
  type MenuItemConstructorOptions,
} from 'electron';
import { AI_OLLAMA_MODELS, ERASE_ALL } from '@shared/ipc/appChannels';
import { listOllamaModels } from './ai/ollamaModels';
import { openDatabase, type Database } from './db/connection';
import { API_KEYS_KEY, getSetting, setSetting } from './db/settings';
import { eraseAll } from './eraseAll';
import { flushBeforeClose } from './flushBeforeClose';
import { registerDbHandlers } from './ipc/registerDbHandlers';
import { registerFileHandlers } from './ipc/registerFileHandlers';
import { registerSecretsHandlers } from './ipc/registerSecretsHandlers';
import { createSecretsHandlers } from './ipc/secretsHandlers';
import { createApiKeys } from './secrets/apiKeys';
import { osKeyring } from './secrets/osKeyring';
import { testApiKey } from './secrets/testApiKey';

const here = path.dirname(fileURLToPath(import.meta.url));

// Unpackaged runs (`bun run dev`, `preview`) keep their data in the repo's gitignored
// .dev-data/, apart from an installed Mosaic's; `bun run dev:reset` wipes it. An explicit
// --user-data-dir (the e2e tests) wins. Must run before the single-instance lock, which
// lives in the profile.
if (!app.isPackaged && !app.commandLine.hasSwitch('user-data-dir')) {
  app.setPath('userData', path.join(app.getAppPath(), '.dev-data'));
}

let db: Database | undefined;

const databaseFile = () => path.join(app.getPath('userData'), 'mosaic.db');

function openAppDatabase(): Database {
  return openDatabase(databaseFile(), {
    // Dev stops on an edited migration (with a `dev:reset` hint); an installed build
    // warns and keeps going rather than lock anyone out of their resumes.
    tolerateEditedMigrations: app.isPackaged,
  });
}

/** Links the user clicks leave the app; nothing else is allowed to navigate it. */
const EXTERNAL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

function openExternally(url: string): void {
  if (EXTERNAL_PROTOCOLS.has(new URL(url).protocol)) void shell.openExternal(url);
}

const devServerUrl = app.isPackaged ? undefined : process.env.ELECTRON_RENDERER_URL;

/** The app's own page: the built index.html, or Vite's dev server during `bun run dev`. */
function isAppFrame(event: IpcMainInvokeEvent): boolean {
  const frame = event.senderFrame;
  if (!frame || frame !== event.sender.mainFrame) return false;
  const { protocol, origin } = new URL(frame.url);
  return (
    protocol === 'file:' || (devServerUrl !== undefined && origin === new URL(devServerUrl).origin)
  );
}

/**
 * The window's colour before the page paints, matching the theme it is about to draw, so
 * there is no flash of the other one. The theme is the renderer's `ui` setting.
 */
function readWindowBackground(): string {
  let theme: unknown;
  try {
    theme = JSON.parse((db && getSetting(db, 'ui')) || '{}')?.state?.theme;
  } catch {
    theme = undefined;
  }
  const isDark =
    theme === 'light' ? false : theme === 'system' ? nativeTheme.shouldUseDarkColors : true;
  return isDark ? '#09090b' : '#ffffff';
}

/**
 * Electron's default menu without its View menu, whose zoom keys (Ctrl/⌘+0, +, −) would
 * zoom the whole window instead of the page in the preview. Edit keeps copy and paste
 * working on macOS. Development keeps reload and DevTools on their usual keys; a release
 * has neither.
 */
function setAppMenu(): void {
  const template: MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' as const }] : []),
    { role: 'fileMenu' },
    { role: 'editMenu' },
    { role: 'windowMenu' },
  ];
  if (!app.isPackaged) {
    template.push({ label: 'Develop', submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }] });
  }
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow(): BrowserWindow {
  // Size from the display rather than fixed pixels; the floor keeps the editor usable.
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  const win = new BrowserWindow({
    width: Math.max(1024, Math.round(width * 0.8)),
    height: Math.max(700, Math.round(height * 0.85)),
    minWidth: 720,
    minHeight: 540,
    show: false,
    title: 'Mosaic',
    backgroundColor: readWindowBackground(),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(here, '../preload/index.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      devTools: !app.isPackaged,
    },
  });

  win.once('ready-to-show', () => win.show());
  flushBeforeClose(win);

  win.webContents.setWindowOpenHandler(({ url }) => {
    // PDF preview opens a blob: URL the renderer just created; it stays in the app.
    if (url.startsWith('blob:')) {
      return { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true } };
    }
    openExternally(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (url === win.webContents.getURL()) return;
    event.preventDefault();
    openExternally(url);
  });

  if (devServerUrl) {
    void win.loadURL(devServerUrl);
  } else {
    void win.loadFile(path.join(here, '../renderer/index.html'));
  }

  return win;
}

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
    ipcMain.handle(AI_OLLAMA_MODELS, (event, address: unknown) => {
      if (!isAppFrame(event)) throw new Error(`Refused model list from ${event.senderFrame?.url}`);
      return listOllamaModels(net.fetch, address);
    });
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
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
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
