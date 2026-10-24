import { contextBridge, ipcRenderer } from 'electron';
import type { MosaicBackup } from '@shared/types/backup';
import type { MosaicDbBridge } from '@shared/types/dbBridge';
import type { MosaicDev } from '@shared/types/devTools';
import type { MosaicFiles } from '@shared/types/files';
import type { MosaicModelProviders } from '@shared/types/modelProviders';
import type { MosaicSecrets } from '@shared/types/secrets';
import {
  BACKUP_CHANNELS,
  DEV_BUILD_ARGUMENT,
  DEV_CHANNELS,
  DEV_OPEN_TOOLS,
  ERASE_ALL,
  FILES_OPEN,
  FILES_SAVE,
  FLUSH_DONE,
  FLUSH_REQUEST,
  HELP_MENU_COMMAND,
  HELP_MENU_COMMANDS,
  type HelpMenuCommand,
  MODEL_PROVIDERS_CHANNELS,
  SECRETS_CHANNELS,
} from '@shared/ipc/appChannels';
import { DB_METHODS, dbChannel } from '@shared/ipc/dbMethods';

// The only door between the sandboxed renderer and the main process: narrow, typed
// methods — never raw IPC or Node.

/** `db.templates.create(…)` → the `db:templates.create` channel, for each method. */
function dbBridge(): MosaicDbBridge {
  const bridge: Record<string, unknown> = {};
  for (const method of DB_METHODS) {
    const path = method.split('.');
    let node = bridge;
    for (const key of path.slice(0, -1)) {
      node = (node[key] ??= {}) as Record<string, unknown>;
    }
    node[path[path.length - 1]] = (...args: unknown[]) =>
      ipcRenderer.invoke(dbChannel(method), ...args);
  }
  return bridge as unknown as MosaicDbBridge;
}

let flushRegistered = false;
let helpMenuRegistered = false;

const files: MosaicFiles = {
  save: (type, suggestedName, content) =>
    ipcRenderer.invoke(FILES_SAVE, type, suggestedName, content),
  open: (type) => ipcRenderer.invoke(FILES_OPEN, type),
};

const backup: MosaicBackup = {
  status: () => ipcRenderer.invoke(BACKUP_CHANNELS.status),
  backUpNow: () => ipcRenderer.invoke(BACKUP_CHANNELS.backUpNow),
  setFrequency: (frequency) => ipcRenderer.invoke(BACKUP_CHANNELS.setFrequency, frequency),
  chooseFolder: () => ipcRenderer.invoke(BACKUP_CHANNELS.chooseFolder),
};

/** Keys go in; nothing here can bring one back out. */
const secrets: MosaicSecrets = {
  status: () => ipcRenderer.invoke(SECRETS_CHANNELS.status),
  save: (provider, key) => ipcRenderer.invoke(SECRETS_CHANNELS.save, provider, key),
  remove: (provider) => ipcRenderer.invoke(SECRETS_CHANNELS.remove, provider),
  setLocation: (location) => ipcRenderer.invoke(SECRETS_CHANNELS.setLocation, location),
  forgetAll: () => ipcRenderer.invoke(SECRETS_CHANNELS.forgetAll),
  test: (provider, model, key) => ipcRenderer.invoke(SECRETS_CHANNELS.test, provider, model, key),
};

const modelProviders: MosaicModelProviders = {
  ollamaModels: (address) => ipcRenderer.invoke(MODEL_PROVIDERS_CHANNELS.ollamaModels, address),
};

/** Development builds only: main passes the argument to their page alone. */
const dev: MosaicDev | undefined = process.argv.includes(DEV_BUILD_ARGUMENT)
  ? {
      readRecent: () => ipcRenderer.invoke(DEV_CHANNELS.readRecent),
      saveRecent: (runs) => ipcRenderer.invoke(DEV_CHANNELS.saveRecent, runs),
      readSwitches: () => ipcRenderer.invoke(DEV_CHANNELS.readSwitches),
      saveSwitches: (switches) => ipcRenderer.invoke(DEV_CHANNELS.saveSwitches, switches),
      readReopenAddress: () => ipcRenderer.invoke(DEV_CHANNELS.readReopenAddress),
      saveReopenAddress: (address) => ipcRenderer.invoke(DEV_CHANNELS.saveReopenAddress, address),
      readMemory: () => ipcRenderer.invoke(DEV_CHANNELS.readMemory),
      readDataFolder: () => ipcRenderer.invoke(DEV_CHANNELS.readDataFolder),
      onOpenTools: (open) => {
        ipcRenderer.on(DEV_OPEN_TOOLS, () => open());
      },
    }
  : undefined;

contextBridge.exposeInMainWorld('mosaic', {
  platform: process.platform,
  db: dbBridge(),
  files,
  backup,
  secrets,
  modelProviders,
  ...(dev && { dev }),
  app: {
    eraseAll: (): Promise<void> => ipcRenderer.invoke(ERASE_ALL),
    /** A Help menu item was chosen. */
    onHelpMenu: (answer: (command: HelpMenuCommand) => void) => {
      if (helpMenuRegistered) return;
      helpMenuRegistered = true;
      ipcRenderer.on(HELP_MENU_COMMAND, (_event, command: unknown) => {
        if (HELP_MENU_COMMANDS.includes(command as HelpMenuCommand)) {
          answer(command as HelpMenuCommand);
        }
      });
    },
    /** Main asks before the window closes; answer once pending saves have landed. */
    onFlushRequest: (flush: () => Promise<boolean>) => {
      if (flushRegistered) return;
      flushRegistered = true;
      ipcRenderer.on(FLUSH_REQUEST, () => {
        void flush()
          .catch(() => false)
          .then((isSaved) => ipcRenderer.send(FLUSH_DONE, isSaved));
      });
    },
  },
});
