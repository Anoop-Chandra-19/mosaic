import type { MosaicBackup } from '../types/backup';
import type { MosaicModelProviders } from '../types/modelProviders';
import type { MosaicSecrets } from '../types/secrets';

/** Main → renderer: the window is closing, save what is pending. */
export const FLUSH_REQUEST = 'app:flush';
/** Renderer → main: pending saves have landed (or failed); the window may close. */
export const FLUSH_DONE = 'app:flushed';
/** Renderer → main: delete everything Mosaic stores on this machine. */
export const ERASE_ALL = 'app:erase-all';
/** Renderer → main: `MosaicFiles` — the system Save and Open dialogs. */
export const FILES_SAVE = 'files:save';
export const FILES_OPEN = 'files:open';

/** Renderer → main: `MosaicBackup`, one channel per method. */
export const BACKUP_CHANNELS = {
  status: 'backup:status',
  backUpNow: 'backup:back-up-now',
  setFrequency: 'backup:set-frequency',
  chooseFolder: 'backup:choose-folder',
} as const satisfies Record<keyof MosaicBackup, string>;

/** Renderer → main: `MosaicModelProviders`, one channel per method. */
export const MODEL_PROVIDERS_CHANNELS = {
  ollamaModels: 'model-providers:ollama-models',
} as const satisfies Record<keyof MosaicModelProviders, string>;

/** Renderer → main: `MosaicSecrets`, one channel per method. */
export const SECRETS_CHANNELS = {
  status: 'secrets:status',
  save: 'secrets:save',
  remove: 'secrets:remove',
  setLocation: 'secrets:set-location',
  forgetAll: 'secrets:forget-all',
  test: 'secrets:test',
} as const satisfies Record<keyof MosaicSecrets, string>;
