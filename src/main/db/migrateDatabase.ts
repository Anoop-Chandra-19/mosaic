import type { Database } from 'better-sqlite3';
import { hashMigration, parseMigrations, type Migration } from './migrationFiles';

/** Every `migrations/NNN_*.sql`, inlined into the main bundle by Vite — no list to maintain. */
export function bundledMigrations(): Migration[] {
  return parseMigrations(
    import.meta.glob<string>('./migrations/*.sql', {
      query: '?raw',
      import: 'default',
      eager: true,
    })
  );
}

export class NewerDatabaseError extends Error {
  constructor(found: number, known: number) {
    super(
      `This database was written by a newer version of Mosaic (schema ${found}; ` +
        `this build knows ${known}). Update Mosaic to open it.`
    );
    this.name = 'NewerDatabaseError';
  }
}

export class EditedMigrationError extends Error {
  constructor(name: string) {
    super(
      `${name} has changed since this database ran it, so the database no longer matches ` +
        `the schema. Quit Mosaic, run \`bun run dev:reset\`, and start it again.`
    );
    this.name = 'EditedMigrationError';
  }
}

/**
 * The runner's own bookkeeping, not app schema: a fingerprint of the SQL each
 * migration ran, so an edit to an already-applied migration is noticed.
 */
const BOOKKEEPING = `
  create table if not exists schema_migrations (
    version    integer primary key,
    name       text not null,
    hash       text not null,
    applied_at integer not null
  ) strict`;

export interface MigrateOptions {
  /**
   * Warn instead of refusing when an applied migration's SQL has changed. Installed
   * builds set this: a mismatch there is our bug, and locking someone out of their
   * resumes is worse than the drift. `released.json` + its test keep it from shipping.
   */
  tolerateEditedMigrations?: boolean;
  /** Tests substitute their own. */
  migrations?: Migration[];
}

/**
 * Bring the schema up to date, tracked by `PRAGMA user_version`. Each migration, its
 * fingerprint, and the version bump commit together, so a crash mid-upgrade leaves the
 * previous schema.
 */
export function migrateDatabase(
  db: Database,
  { tolerateEditedMigrations = false, migrations = bundledMigrations() }: MigrateOptions = {}
): void {
  const current = db.pragma('user_version', { simple: true }) as number;
  // Never touch a schema we do not understand: an older build would corrupt it.
  if (current > migrations.length) throw new NewerDatabaseError(current, migrations.length);

  db.exec(BOOKKEEPING);

  const recorded = new Map(
    db
      .prepare<[], { version: number; hash: string }>('select version, hash from schema_migrations')
      .all()
      .map((row) => [row.version, row.hash])
  );
  for (const migration of migrations.slice(0, current)) {
    if (recorded.get(migration.version) === hashMigration(migration.sql)) continue;
    const error = new EditedMigrationError(migration.name);
    if (!tolerateEditedMigrations) throw error;
    console.warn(error.message);
  }

  const record = db.prepare(
    'insert into schema_migrations (version, name, hash, applied_at) values (?, ?, ?, ?)'
  );
  for (const migration of migrations.slice(current)) {
    db.transaction(() => {
      db.exec(migration.sql);
      record.run(migration.version, migration.name, hashMigration(migration.sql), Date.now());
      db.pragma(`user_version = ${migration.version}`);
    })();
  }
}
