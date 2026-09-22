import type { MosaicBackup } from '../types/backup';
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

/** Renderer → main: `MosaicAI` — the chat models pulled into the local Ollama. */
export const AI_OLLAMA_MODELS = 'ai:ollama-models';

/** Renderer → main: `MosaicSecrets`, one channel per method. */
export const SECRETS_CHANNELS = {
  status: 'secrets:status',
  save: 'secrets:save',
  remove: 'secrets:remove',
  setLocation: 'secrets:set-location',
  forgetAll: 'secrets:forget-all',
  test: 'secrets:test',
} as const satisfies Record<keyof MosaicSecrets, string>;
