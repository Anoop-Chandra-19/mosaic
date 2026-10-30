import { ipcMain, net, type IpcMainInvokeEvent } from 'electron';
import type { Database } from 'better-sqlite3';
import type { UsedModel } from '@shared/types/modelProviders';
import { MODEL_PROVIDERS_CHANNELS } from '@shared/ipc/appChannels';
import { listUsedModels } from '../db/conversations/runs';
import { isModelProviderId } from '../model-providers/createModelProvider';
import { listOllamaModels } from '../model-providers/model-lists/ollamaModels';

/** Runs recorded with a provider this build no longer knows are left out. */
function readUsedModels(db: Database | undefined): UsedModel[] {
  if (!db) return [];
  return listUsedModels(db).filter((used): used is UsedModel => isModelProviderId(used.provider));
}

/** Answer the preload's `modelProviders` calls, from the app's own page only. */
export function registerModelProviderHandlers(
  getDb: () => Database | undefined,
  isAppFrame: (event: IpcMainInvokeEvent) => boolean
): void {
  const refuseOtherFrames = (event: IpcMainInvokeEvent) => {
    if (!isAppFrame(event)) throw new Error(`Refused model list from ${event.senderFrame?.url}`);
  };
  ipcMain.handle(MODEL_PROVIDERS_CHANNELS.usedModels, (event) => {
    refuseOtherFrames(event);
    return readUsedModels(getDb());
  });
  ipcMain.handle(MODEL_PROVIDERS_CHANNELS.ollamaModels, (event, address: unknown) => {
    refuseOtherFrames(event);
    return listOllamaModels(net.fetch, address);
  });
}
