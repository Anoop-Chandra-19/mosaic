import { ipcMain, type BrowserWindow, type IpcMainEvent } from 'electron';
import { FLUSH_DONE, FLUSH_REQUEST } from '@shared/ipc/appChannels';

/**
 * Hold a closing window open until its renderer has saved what it was still waiting to
 * save (draft saves wait for a pause in typing), or `timeoutMs` passes — a hung renderer
 * must not keep the app from quitting.
 */
export function flushBeforeClose(win: BrowserWindow, timeoutMs = 2000): void {
  let state: 'open' | 'flushing' | 'flushed' = 'open';

  win.on('close', (event) => {
    if (state === 'flushed' || win.webContents.isDestroyed() || win.webContents.isCrashed()) {
      return;
    }
    event.preventDefault();
    if (state === 'flushing') return;
    state = 'flushing';

    const finish = () => {
      if (state === 'flushed') return;
      state = 'flushed';
      clearTimeout(timer);
      ipcMain.removeListener(FLUSH_DONE, onDone);
      if (!win.isDestroyed()) win.close();
    };
    const onDone = (done: IpcMainEvent) => {
      if (done.sender === win.webContents) finish();
    };
    const timer = setTimeout(finish, timeoutMs);
    ipcMain.on(FLUSH_DONE, onDone);
    win.webContents.send(FLUSH_REQUEST);
  });
}
