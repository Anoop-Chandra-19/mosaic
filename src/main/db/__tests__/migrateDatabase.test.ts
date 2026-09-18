import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import BetterSqlite from 'better-sqlite3';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openDatabase, type Database } from '../connection';
import {
  bundledMigrations,
  EditedMigrationError,
  migrateDatabase,
  NewerDatabaseError,
} from '../migrateDatabase';
import { hashMigration, parseMigrations, type Migration } from '../migrationFiles';

const MIGRATIONS_DIR = path.resolve(import.meta.dirname, '../migrations');

let db: Database | undefined;

afterEach(() => {
  db?.close();
  db = undefined;
  vi.restoreAllMocks();
});

function tableNames(db: Database): string[] {
  return db
    .prepare<[], { name: string }>(
      "select name from sqlite_schema where type = 'table' order by name"
    )
    .all()
    .map((row) => row.name);
}

/** Stand-in migrations, so upgrades and edits can be tested without touching the real ones. */
const first: Migration = {
  version: 1,
  name: '001_a.sql',
  sql: 'create table a (x integer) strict',
};
const second: Migration = { version: 2, name: '002_b.sql', sql: 'create table b (y text) strict' };

describe('migrateDatabase', () => {
  it('builds the schema on an empty database and records its version', () => {
    db = openDatabase(':memory:');
    expect(db.pragma('user_version', { simple: true })).toBe(bundledMigrations().length);
    expect(tableNames(db)).toEqual([
      'drafts',
      'schema_migrations',
      'settings',
      'templates',
      'versions',
    ]);
  });

  it('is a no-op on an up-to-date database', () => {
    db = openDatabase(':memory:');
    db.prepare("insert into settings (key, value) values ('k', 'v')").run();
    migrateDatabase(db);
    expect(db.pragma('user_version', { simple: true })).toBe(bundledMigrations().length);
    expect(db.prepare('select value from settings').pluck().get()).toBe('v');
  });

  it('runs only the migrations a database has not run yet, and fingerprints each', () => {
    db = new BetterSqlite(':memory:');
    migrateDatabase(db, { migrations: [first] });
    db.prepare('insert into a (x) values (1)').run();

    migrateDatabase(db, { migrations: [first, second] });

    expect(db.pragma('user_version', { simple: true })).toBe(2);
    expect(db.prepare('select x from a').pluck().get()).toBe(1);
    expect(db.prepare('select version, name, hash from schema_migrations').all()).toEqual([
      { version: 1, name: '001_a.sql', hash: hashMigration(first.sql) },
      { version: 2, name: '002_b.sql', hash: hashMigration(second.sql) },
    ]);
  });

  it('refuses a database written by a newer build, without touching it', () => {
    db = new BetterSqlite(':memory:');
    migrateDatabase(db, { migrations: [first, second] });

    expect(() => migrateDatabase(db!, { migrations: [first] })).toThrow(NewerDatabaseError);
  });

  it('stops when an applied migration has been edited', () => {
    db = new BetterSqlite(':memory:');
    migrateDatabase(db, { migrations: [first] });
    const edited = { ...first, sql: 'create table a (x integer, z integer) strict' };

    expect(() => migrateDatabase(db!, { migrations: [edited] })).toThrow(EditedMigrationError);
    expect(() => migrateDatabase(db!, { migrations: [edited] })).toThrow(/bun run dev:reset/);
  });

  it('only warns about an edited migration when told to tolerate it (installed builds)', () => {
    db = new BetterSqlite(':memory:');
    migrateDatabase(db, { migrations: [first] });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const edited = { ...first, sql: `${first.sql};` };

    migrateDatabase(db, { migrations: [edited, second], tolerateEditedMigrations: true });

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('001_a.sql has changed'));
    expect(db.pragma('user_version', { simple: true })).toBe(2);
  });

  it('treats a database without fingerprints as not matching', () => {
    db = new BetterSqlite(':memory:');
    db.exec(first.sql);
    db.pragma('user_version = 1'); // migrated before fingerprints existed

    expect(() => migrateDatabase(db!, { migrations: [first] })).toThrow(EditedMigrationError);
  });

  it('enforces column types and JSON documents', () => {
    db = openDatabase(':memory:');
    const insertTemplate = db.prepare(
      "insert into templates (id, name, seq, rev, created_at, updated_at) values ('t', 'T', 1, ?, 0, 0)"
    );
    expect(() => insertTemplate.run('not a number')).toThrow(/cannot store TEXT/);
    insertTemplate.run(0);
    expect(() =>
      db!.prepare("insert into drafts (template_id, doc, updated_at) values ('t', '{', 0)").run()
    ).toThrow(/CHECK constraint failed/);
  });
});

describe('migration files', () => {
  it('orders files by number and names them without their folder', () => {
    const migrations = parseMigrations({
      './migrations/002_b.sql': 'b',
      './migrations/001_a.sql': 'a',
    });
    expect(migrations).toEqual([
      { version: 1, name: '001_a.sql', sql: 'a' },
      { version: 2, name: '002_b.sql', sql: 'b' },
    ]);
  });

  it('refuses gaps, repeats, and badly named files', () => {
    expect(() => parseMigrations({ '001_a.sql': '', '003_c.sql': '' })).toThrow(
      /no gaps or repeats/
    );
    expect(() => parseMigrations({ '001_a.sql': '', '001_b.sql': '' })).toThrow(
      /no gaps or repeats/
    );
    expect(() => parseMigrations({ '002_b.sql': '' })).toThrow(/no gaps or repeats/);
    expect(() => parseMigrations({ '1_init.sql': '' })).toThrow(/NNN_description\.sql/);
    expect(() => parseMigrations({ '001-Init.sql': '' })).toThrow(/NNN_description\.sql/);
  });

  it('fingerprints ignore Windows line endings', () => {
    expect(hashMigration('create table a (\r\n  x integer\r\n)')).toBe(
      hashMigration('create table a (\n  x integer\n)')
    );
  });

  it('bundles every .sql file in the migrations folder', () => {
    const onDisk = fs.readdirSync(MIGRATIONS_DIR).filter((name) => name.endsWith('.sql'));
    expect(bundledMigrations().map((m) => m.name)).toEqual(onDisk.sort());
  });

  it('released migrations are unchanged (see `bun run db:freeze`)', () => {
    const released = JSON.parse(
      fs.readFileSync(path.join(MIGRATIONS_DIR, 'released.json'), 'utf8')
    ) as Record<string, string>;
    const current = new Map(bundledMigrations().map((m) => [m.name, hashMigration(m.sql)]));

    for (const [name, hash] of Object.entries(released)) {
      // Users' databases already ran this file. Revert the edit; put changes in a new migration.
      expect(current.get(name), `${name} was edited after it was released`).toBe(hash);
    }
  });
});

describe('openDatabase', () => {
  it('opens a file database in WAL mode with foreign keys on, and closes cleanly', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mosaic-db-'));
    try {
      const file = path.join(dir, 'mosaic.db');
      db = openDatabase(file);
      expect(db.pragma('journal_mode', { simple: true })).toBe('wal');
      expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
      db.close();
      db = undefined;
      // Closing the last connection checkpoints the WAL and removes its side files.
      expect(fs.readdirSync(dir)).toEqual(['mosaic.db']);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
