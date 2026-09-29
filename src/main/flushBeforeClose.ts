import { dialog, ipcMain, type BrowserWindow, type IpcMainEvent } from 'electron';
import { FLUSH_DONE, FLUSH_REQUEST } from '@shared/ipc/appChannels';

/**
 * Hold a closing window open until its renderer has saved what it was still waiting to
 * save (draft saves wait for a pause in typing), or `timeoutMs` passes — a hung renderer
 * must not keep the app from quitting. If the draft couldn't be saved, ask before closing.
 */
export function flushBeforeClose(win: BrowserWindow, timeoutMs = 2000): void {
  let state: 'open' | 'flushing' | 'asking' | 'flushed' = 'open';

  win.on('close', (event) => {
    if (state === 'flushed' || win.webContents.isDestroyed() || win.webContents.isCrashed()) {
      return;
    }
    event.preventDefault();
    if (state !== 'open') return;
    state = 'flushing';

    const stopWaiting = () => {
      clearTimeout(timer);
      ipcMain.removeListener(FLUSH_DONE, onDone);
    };
    const finish = () => {
      if (state === 'flushed') return;
      stopWaiting();
      state = 'flushed';
      if (!win.isDestroyed()) win.close();
    };
    const onDone = (done: IpcMainEvent, isSaved: unknown) => {
      if (done.sender !== win.webContents) return;
      if (isSaved !== false) return finish();
      stopWaiting();
      state = 'asking';
      void askToCloseUnsaved(win).then((shouldClose) => {
        if (shouldClose) finish();
        else state = 'open';
      });
    };
    const timer = setTimeout(finish, timeoutMs);
    ipcMain.on(FLUSH_DONE, onDone);
    win.webContents.send(FLUSH_REQUEST);
  });
}

async function askToCloseUnsaved(win: BrowserWindow): Promise<boolean> {
  if (win.isDestroyed()) return true;
  const { response } = await dialog.showMessageBox(win, {
    type: 'warning',
    message: 'Your latest edits couldn’t be saved.',
    detail: 'If you close Mosaic now, they will be lost. Keep it open to try again.',
    buttons: ['Keep Mosaic open', 'Close anyway'],
    defaultId: 0,
    cancelId: 0,
  });
  return response === 1;
}
