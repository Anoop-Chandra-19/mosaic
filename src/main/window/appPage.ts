import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';

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

/** A PDF preview popup shares the preload, but has no business in the database or the keys. */
export function isAppFrame(event: IpcMainInvokeEvent): boolean {
  const frame = event.senderFrame;
  if (!frame || frame !== event.sender.mainFrame) return false;
  const { protocol, origin } = new URL(frame.url);
  return (
    protocol === 'file:' || (devServerUrl !== undefined && origin === new URL(devServerUrl).origin)
  );
}
