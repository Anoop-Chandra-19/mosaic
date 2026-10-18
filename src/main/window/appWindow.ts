import { app, BrowserWindow, nativeTheme, screen, shell } from 'electron';
import { getAppDatabase } from '../db/appDatabase';
import { getSetting } from '../db/settings';
import { loadAppPage, PRELOAD_FILE } from './appPage';
import { flushBeforeClose } from './flushBeforeClose';

/** Links the user clicks leave the app; nothing else is allowed to navigate it. */
const EXTERNAL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

function openExternally(url: string): void {
  if (EXTERNAL_PROTOCOLS.has(new URL(url).protocol)) void shell.openExternal(url);
}

/**
 * The window's colour before the page paints, matching the theme it is about to draw, so
 * there is no flash of the other one. The theme is in the renderer's stored `ui` setting.
 */
function readWindowBackground(storedUiSetting: string | null): string {
  let theme: unknown;
  try {
    theme = JSON.parse(storedUiSetting || '{}')?.state?.theme;
  } catch {
    theme = undefined;
  }
  const isDark =
    theme === 'light' ? false : theme === 'system' ? nativeTheme.shouldUseDarkColors : true;
  return isDark ? '#09090b' : '#ffffff';
}

/** The app window, drawn in the theme the renderer stored. */
export function openAppWindow(): BrowserWindow {
  const db = getAppDatabase();
  return createWindow(db ? getSetting(db, 'ui') : null);
}

function createWindow(storedUiSetting: string | null): BrowserWindow {
  // Size from the display rather than fixed pixels; the floor keeps the editor usable.
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  const win = new BrowserWindow({
    width: Math.max(1024, Math.round(width * 0.8)),
    height: Math.max(700, Math.round(height * 0.85)),
    minWidth: 720,
    minHeight: 540,
    show: false,
    title: 'Mosaic',
    backgroundColor: readWindowBackground(storedUiSetting),
    autoHideMenuBar: true,
    webPreferences: {
      preload: PRELOAD_FILE,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      devTools: !app.isPackaged,
    },
  });

  win.once('ready-to-show', () => win.show());
  flushBeforeClose(win);

  // No popups: a child window would inherit the preload. Links go to the browser instead.
  win.webContents.setWindowOpenHandler(({ url }) => {
    openExternally(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (url === win.webContents.getURL()) return;
    event.preventDefault();
    openExternally(url);
  });

  loadAppPage(win);
  return win;
}
