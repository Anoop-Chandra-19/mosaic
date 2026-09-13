import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import type { Database } from 'better-sqlite3';
import { DB_METHODS, dbChannel } from '../../shared/dbMethods';
import { createDbHandlers, handlerFor, settle } from './dbHandlers';

/**
 * Answer the preload's `db:*` calls. `isAppFrame` turns away anything but the app's own
 * page — a PDF preview popup shares the preload, but has no business in the database.
 */
export function registerDbHandlers(
  db: Database,
  isAppFrame: (event: IpcMainInvokeEvent) => boolean
): void {
  const handlers = createDbHandlers(db);
  for (const method of DB_METHODS) {
    const handler = handlerFor(handlers, method);
    ipcMain.handle(dbChannel(method), (event, ...args: unknown[]) => {
      if (!isAppFrame(event)) throw new Error(`Refused ${method} from ${event.senderFrame?.url}`);
      return settle(() => handler(...args));
    });
  }
}
