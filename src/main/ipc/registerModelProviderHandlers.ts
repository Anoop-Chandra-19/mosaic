import { ipcMain, net, type IpcMainInvokeEvent } from 'electron';
import { MODEL_PROVIDERS_CHANNELS } from '@shared/ipc/appChannels';
import { listOllamaModels } from '../model-providers/ollamaModels';

/** Answer the preload's `modelProviders` calls, from the app's own page only. */
export function registerModelProviderHandlers(
  isAppFrame: (event: IpcMainInvokeEvent) => boolean
): void {
  ipcMain.handle(MODEL_PROVIDERS_CHANNELS.ollamaModels, (event, address: unknown) => {
    if (!isAppFrame(event)) throw new Error(`Refused model list from ${event.senderFrame?.url}`);
    return listOllamaModels(net.fetch, address);
  });
}
