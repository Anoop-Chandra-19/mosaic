import Database from 'better-sqlite3';
import { migrateDatabase, type MigrateOptions } from './migrateDatabase';

export type { Database } from 'better-sqlite3';

/**
 * Open the app database (`:memory:` in tests) and migrate it. Main owns the only
 * connection — the single-instance lock keeps it that way.
 */
export function openDatabase(file: string, options?: MigrateOptions): Database.Database {
  const db = new Database(file);
  try {
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL'); // with WAL: durable across app crashes, not power loss
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 2000');
    migrateDatabase(db, options);
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}
