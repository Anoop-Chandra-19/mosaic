import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, screen, shell } from 'electron';

const here = path.dirname(fileURLToPath(import.meta.url));

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
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
