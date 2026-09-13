import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, dialog, screen, shell } from 'electron';
import { openDatabase, type Database } from './db/connection';

const here = path.dirname(fileURLToPath(import.meta.url));

// Unpackaged runs (`bun run dev`, `preview`) keep their data in the repo's gitignored
// .dev-data/, apart from an installed Mosaic's; `bun run dev:reset` wipes it. An explicit
// --user-data-dir (the e2e tests) wins. Must run before the single-instance lock, which
// lives in the profile.
if (!app.isPackaged && !app.commandLine.hasSwitch('user-data-dir')) {
  app.setPath('userData', path.join(app.getAppPath(), '.dev-data'));
}

let db: Database | undefined;

/** Links the user clicks leave the app; nothing else is allowed to navigate it. */
const EXTERNAL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

function openExternally(url: string): void {
  if (EXTERNAL_PROTOCOLS.has(new URL(url).protocol)) void shell.openExternal(url);
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
    // Matches the app's default dark theme, so there is no white flash before first paint.
    backgroundColor: '#09090b',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(here, '../preload/index.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  win.once('ready-to-show', () => win.show());

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

  const devServerUrl = process.env.ELECTRON_RENDERER_URL;
  if (!app.isPackaged && devServerUrl) {
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
      db = openDatabase(path.join(app.getPath('userData'), 'mosaic.db'));
    } catch (error) {
      // E.g. a database written by a newer Mosaic: say so rather than open an empty app.
      dialog.showErrorBox('Mosaic could not open its data', (error as Error).message);
      app.exit(1);
      return;
    }
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  // Closing the last connection checkpoints the WAL into mosaic.db and removes -wal/-shm.
  app.on('will-quit', () => {
    db?.close();
    db = undefined;
  });
}
