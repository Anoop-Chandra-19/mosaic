import { createHash } from 'node:crypto';

/*
 * Plain file handling shared by the migration runner (files inlined by Vite) and
 * `bun run db:freeze` (files read from disk). No Vite or Electron in here.
 */

export interface Migration {
  /** 1 for 001_init.sql — the `user_version` a database has once this has run. */
  version: number;
  name: string;
  sql: string;
}

const FILE_NAME = /^(\d{3})_[a-z0-9_]+\.sql$/;

/**
 * Order migration files by number, refusing gaps and repeats: every database, on every
 * machine, must go through the same steps in the same order.
 */
export function parseMigrations(files: Record<string, string>): Migration[] {
  const migrations = Object.entries(files)
    .map(([file, sql]) => {
      const name = file.split('/').pop()!;
      const match = FILE_NAME.exec(name);
      if (!match) {
        throw new Error(
          `Migration ${name} must be named NNN_description.sql, e.g. 002_add_notes.sql`
        );
      }
      return { version: Number(match[1]), name, sql };
    })
    .sort((a, b) => a.version - b.version);

  migrations.forEach((migration, index) => {
    const expected = String(index + 1).padStart(3, '0');
    if (migration.version !== index + 1) {
      throw new Error(
        `Migrations must be numbered 001, 002, … with no gaps or repeats: found ` +
          `${migration.name} where ${expected}_… belongs.`
      );
    }
  });
  return migrations;
}

/**
 * The fingerprint a database records for each migration it runs. Line endings are
 * normalized: Git on Windows may check .sql files out with CRLF, which must not look
 * like an edit.
 */
export function hashMigration(sql: string): string {
  return createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex');
}
