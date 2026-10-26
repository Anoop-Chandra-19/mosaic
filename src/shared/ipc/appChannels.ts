import type { MosaicBackup } from '../types/backup';
import type { MosaicDev } from '../types/devTools';
import type { MosaicModelProviders } from '../types/modelProviders';
import type { MosaicSecrets } from '../types/secrets';

/** Main → renderer: the window is closing, save what is pending. */
export const FLUSH_REQUEST = 'app:flush';
/** Renderer → main: pending saves have landed (or failed); the window may close. */
export const FLUSH_DONE = 'app:flushed';
/** Main → renderer: a Help menu item was chosen, one of `HELP_MENU_COMMANDS`. */
export const HELP_MENU_COMMAND = 'app:help-menu';
export const HELP_MENU_COMMANDS = ['shortcuts', 'copyViewAddress', 'about'] as const;
export type HelpMenuCommand = (typeof HELP_MENU_COMMANDS)[number];
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
  check: 'secrets:check',
  remove: 'secrets:remove',
  forgetAll: 'secrets:forget-all',
} as const satisfies Record<keyof MosaicSecrets, string>;

/**
 * Development builds only. Main passes `DEV_BUILD_ARGUMENT` to the page, and the preload
 * exposes `MosaicDev` only when it is there.
 */
export const DEV_BUILD_ARGUMENT = '--mosaic-dev';
/** Renderer → main: `MosaicDev`'s requests, one channel per method. */
export const DEV_CHANNELS = {
  readRecent: 'dev:read-recent',
  saveRecent: 'dev:save-recent',
  readSwitches: 'dev:read-switches',
  saveSwitches: 'dev:save-switches',
  readReopenAddress: 'dev:read-reopen-address',
  saveReopenAddress: 'dev:save-reopen-address',
  readMemory: 'dev:read-memory',
  readDataFolder: 'dev:read-data-folder',
} as const satisfies Record<Exclude<keyof MosaicDev, 'onOpenTools'>, string>;
/** Main → renderer: Develop › Developer tools… was chosen. */
export const DEV_OPEN_TOOLS = 'dev:open-tools';
