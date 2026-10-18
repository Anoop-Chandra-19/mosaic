import { app, BrowserWindow } from 'electron';
import { openAppWindow } from './appWindow';

/** A second launch focuses the window already open instead of opening another. */
export function focusExistingWindowOnSecondLaunch(): void {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows();
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });
}

/** macOS keeps the app running with no window; clicking its icon opens one again. */
export function reopenWindowOnActivate(): void {
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) openAppWindow();
  });
}

/**
 * Quit when the last window closes, except on macOS. A window holds its close until the
 * renderer has saved (see flushBeforeClose), which cancels a quit in progress; the quit is
 * remembered so it still happens once the windows close.
 */
export function quitOnceWindowsClose(): void {
  let isQuitting = false;
  app.on('before-quit', () => {
    isQuitting = true;
  });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin' || isQuitting) app.quit();
  });
}
