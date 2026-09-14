import type { MosaicSecrets } from '@/types/secrets';

/** Main → renderer: the window is closing, save what is pending. */
export const FLUSH_REQUEST = 'app:flush';
/** Renderer → main: pending saves have landed (or failed); the window may close. */
export const FLUSH_DONE = 'app:flushed';
/** Renderer → main: delete everything Mosaic stores on this machine. */
export const ERASE_ALL = 'app:erase-all';
/** Renderer → main: `MosaicFiles` — the system Save and Open dialogs. */
export const FILES_SAVE = 'files:save';
export const FILES_OPEN = 'files:open';

/** Renderer → main: `MosaicSecrets`, one channel per method. */
export const SECRETS_CHANNELS = {
  status: 'secrets:status',
  save: 'secrets:save',
  remove: 'secrets:remove',
  setLocation: 'secrets:set-location',
  forgetAll: 'secrets:forget-all',
  test: 'secrets:test',
} as const satisfies Record<keyof MosaicSecrets, string>;
