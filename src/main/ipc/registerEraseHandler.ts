import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { ERASE_ALL } from '@shared/ipc/appChannels';
import type { AgentRuns } from '../agent/agentRuns';
import { closeAppDatabase, databaseFile, openAppDatabase } from '../db/appDatabase';
import { eraseAll } from '../eraseAll';
import type { ApiKeys } from '../secrets/apiKeys';

/** Answer Settings' Erase, from the app's own page only. */
export function registerEraseHandler(
  apiKeys: ApiKeys,
  agentRuns: AgentRuns,
  isAppFrame: (event: IpcMainInvokeEvent) => boolean
): void {
  ipcMain.handle(ERASE_ALL, (event) => {
    if (!isAppFrame(event)) throw new Error(`Refused erase from ${event.senderFrame?.url}`);
    return eraseAll({
      holdKeyChanges: () => apiKeys.holdChanges(),
      stopRuns: () => agentRuns.stopAll(),
      forgetKeys: () => apiKeys.forgetAll(),
      file: databaseFile(),
      close: closeAppDatabase,
      reopen: openAppDatabase,
    });
  });
}
