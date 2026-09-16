import { contextBridge, ipcRenderer } from 'electron';
import type { MosaicAI } from '@/types/ai';
import type { MosaicDbBridge } from '@/types/db';
import type { MosaicFiles } from '@/types/files';
import type { MosaicSecrets } from '@/types/secrets';
import {
  AI_OLLAMA_MODELS,
  ERASE_ALL,
  FILES_OPEN,
  FILES_SAVE,
  FLUSH_DONE,
  FLUSH_REQUEST,
  SECRETS_CHANNELS,
} from '../shared/appChannels';
import { DB_METHODS, dbChannel } from '../shared/dbMethods';

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

const files: MosaicFiles = {
  save: (type, suggestedName, content) =>
    ipcRenderer.invoke(FILES_SAVE, type, suggestedName, content),
  open: (type) => ipcRenderer.invoke(FILES_OPEN, type),
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

const ai: MosaicAI = {
  ollamaModels: (address) => ipcRenderer.invoke(AI_OLLAMA_MODELS, address),
};

contextBridge.exposeInMainWorld('mosaic', {
  platform: process.platform,
  db: dbBridge(),
  files,
  secrets,
  ai,
  app: {
    eraseAll: (): Promise<void> => ipcRenderer.invoke(ERASE_ALL),
    /** Main asks before the window closes; answer once pending saves have landed. */
    onFlushRequest: (flush: () => Promise<void>) => {
      if (flushRegistered) return;
      flushRegistered = true;
      ipcRenderer.on(FLUSH_REQUEST, () => {
        void flush()
          .catch(() => {})
          .finally(() => ipcRenderer.send(FLUSH_DONE));
      });
    },
  },
});
