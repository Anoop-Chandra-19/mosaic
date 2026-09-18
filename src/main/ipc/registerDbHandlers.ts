import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import type { Database } from 'better-sqlite3';
import type { MosaicDb } from '@shared/types/db';
import { DB_METHODS, dbChannel } from '@shared/ipc/dbMethods';
import { createDbHandlers, handlerFor, settle, type Handlers } from './dbHandlers';

/**
 * Answer the preload's `db:*` calls. `isAppFrame` turns away anything but the app's own
 * page — a PDF preview popup shares the preload, but has no business in the database.
 * `currentDb` is asked on every call: Erase swaps the connection for a fresh file.
 */
export function registerDbHandlers(
  currentDb: () => Database | undefined,
  isAppFrame: (event: IpcMainInvokeEvent) => boolean
): void {
  const handlersByDb = new WeakMap<Database, Handlers<MosaicDb>>();
  const handlers = () => {
    const db = currentDb();
    if (!db) throw new Error('The database is closed');
    let found = handlersByDb.get(db);
    if (!found) handlersByDb.set(db, (found = createDbHandlers(db)));
    return found;
  };

  for (const method of DB_METHODS) {
    ipcMain.handle(dbChannel(method), (event, ...args: unknown[]) => {
      if (!isAppFrame(event)) throw new Error(`Refused ${method} from ${event.senderFrame?.url}`);
      return settle(() => handlerFor(handlers(), method)(...args));
    });
  }
}
