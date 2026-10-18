import { ipcMain, net, type IpcMainInvokeEvent } from 'electron';
import type { MosaicSecrets } from '@shared/types/secrets';
import { SECRETS_CHANNELS } from '@shared/ipc/appChannels';
import { testApiKey } from '../model-providers/testApiKey';
import type { ApiKeys } from '../secrets/apiKeys';
import { createSecretsHandlers } from './secretsHandlers';

/** Answer the preload's `secrets:*` calls, from the app's own page only. */
export function registerSecretsHandlers(
  apiKeys: ApiKeys,
  isAppFrame: (event: IpcMainInvokeEvent) => boolean
): void {
  const handlers = createSecretsHandlers(apiKeys, (provider, key, model) =>
    testApiKey(provider, key, model, net.fetch)
  );
  for (const [method, channel] of Object.entries(SECRETS_CHANNELS)) {
    const handler = handlers[method as keyof MosaicSecrets] as (...args: unknown[]) => unknown;
    ipcMain.handle(channel, (event, ...args: unknown[]) => {
      if (!isAppFrame(event)) throw new Error(`Refused ${channel} from ${event.senderFrame?.url}`);
      return handler(...args);
    });
  }
}
