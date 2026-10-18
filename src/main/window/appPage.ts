import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import { isAppPageUrl } from './isAppPageUrl';

// The app's own page: the built index.html, or Vite's dev server during `bun run dev`. The
// window loads it from here, and every IPC handler asks here whether a call came from it.

const here = path.dirname(fileURLToPath(import.meta.url));
const devServerUrl = app.isPackaged ? undefined : process.env.ELECTRON_RENDERER_URL;

export const PRELOAD_FILE = path.join(here, '../preload/index.cjs');

export function loadAppPage(win: BrowserWindow): void {
  if (devServerUrl) {
    void win.loadURL(devServerUrl);
  } else {
    void win.loadFile(path.join(here, '../renderer/index.html'));
  }
}

/**
 * Whether an IPC call came from the app's own page, in its window's top frame. The window
 * opens no popups and never navigates away, so this is the backstop: an iframe, or any
 * other page that somehow got the preload, is refused the database and the keys.
 */
export function isAppFrame(event: IpcMainInvokeEvent): boolean {
  const frame = event.senderFrame;
  if (!frame || frame !== event.sender.mainFrame) return false;
  return isAppPageUrl(frame.url, devServerUrl);
}
