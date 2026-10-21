import os from 'node:os';
import path from 'node:path';
import { app, ipcMain, type IpcMainInvokeEvent } from 'electron';
import { DEV_CHANNELS } from '@shared/ipc/appChannels';
import { databaseFile } from '../db/appDatabase';
import { readRecentDevRuns, saveRecentDevRuns } from './devHandlers';

/** Answer the preload's `dev` calls, from the app's own page only. Development builds only. */
export function registerDevHandlers(isAppFrame: (event: IpcMainInvokeEvent) => boolean): void {
  const file = path.join(app.getPath('userData'), 'dev-tools.json');
  const refuseOthers = (event: IpcMainInvokeEvent) => {
    if (!isAppFrame(event)) {
      throw new Error(`Refused developer tools from ${event.senderFrame?.url}`);
    }
  };
  ipcMain.handle(DEV_CHANNELS.readRecent, (event) => {
    refuseOthers(event);
    return readRecentDevRuns(file);
  });
  ipcMain.handle(DEV_CHANNELS.saveRecent, (event, runs: unknown) => {
    refuseOthers(event);
    return saveRecentDevRuns(file, runs);
  });
  ipcMain.handle(DEV_CHANNELS.readDataFolder, (event) => {
    refuseOthers(event);
    const folder = path.dirname(databaseFile());
    const home = os.homedir();
    return folder.startsWith(home + path.sep) ? `~${folder.slice(home.length)}` : folder;
  });
}
