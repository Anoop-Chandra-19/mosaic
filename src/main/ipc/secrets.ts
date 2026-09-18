import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import type { MosaicSecrets } from '@shared/types/secrets';
import { SECRETS_CHANNELS } from '@shared/ipc/appChannels';
import type { SecretsHandlers } from './secretsHandlers';

/** Answer the preload's `secrets:*` calls, from the app's own page only. */
export function registerSecretsHandlers(
  handlers: SecretsHandlers,
  isAppFrame: (event: IpcMainInvokeEvent) => boolean
): void {
  for (const [method, channel] of Object.entries(SECRETS_CHANNELS)) {
    const handler = handlers[method as keyof MosaicSecrets] as (...args: unknown[]) => unknown;
    ipcMain.handle(channel, (event, ...args: unknown[]) => {
      if (!isAppFrame(event)) throw new Error(`Refused ${channel} from ${event.senderFrame?.url}`);
      return handler(...args);
    });
  }
}
