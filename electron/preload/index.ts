import { contextBridge, ipcRenderer } from 'electron';
import type { MosaicDbBridge } from '@/types/db';
import { DB_METHODS, dbChannel } from '../shared/dbMethods';

// The only door between the sandboxed renderer and the main process: narrow, typed
// methods — never raw IPC or Node. Secrets arrive in a later PR.

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

contextBridge.exposeInMainWorld('mosaic', {
  platform: process.platform,
  db: dbBridge(),
});
