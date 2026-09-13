import type { Database } from 'better-sqlite3';
import init from './migrations/001_init.sql?raw';

/** Index i holds the SQL that takes the schema from version i to i + 1. */
const MIGRATIONS: readonly string[] = [init];

export const SCHEMA_VERSION = MIGRATIONS.length;

export class NewerDatabaseError extends Error {
  constructor(found: number) {
    super(
      `This database was written by a newer version of Mosaic (schema ${found}; ` +
        `this build knows ${SCHEMA_VERSION}). Update Mosaic to open it.`
    );
    this.name = 'NewerDatabaseError';
  }
}

/**
 * Bring the schema up to date, tracked by `PRAGMA user_version`. Each migration and
 * its version bump commit together, so a crash mid-upgrade leaves the previous schema.
 */
export function migrate(db: Database): void {
  const current = db.pragma('user_version', { simple: true }) as number;
  // Never touch a schema we do not understand: an older build would corrupt it.
  if (current > SCHEMA_VERSION) throw new NewerDatabaseError(current);

  for (let version = current; version < SCHEMA_VERSION; version++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[version]);
      db.pragma(`user_version = ${version + 1}`);
    })();
  }
}
