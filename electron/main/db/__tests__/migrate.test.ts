import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase, type Database } from '../connection';
import { migrate, NewerDatabaseError, SCHEMA_VERSION } from '../migrate';

let db: Database | undefined;

afterEach(() => {
  db?.close();
  db = undefined;
});

function tableNames(db: Database): string[] {
  return db
    .prepare<[], { name: string }>(
      "select name from sqlite_schema where type = 'table' order by name"
    )
    .all()
    .map((row) => row.name);
}

describe('migrate', () => {
  it('builds the schema on an empty database and records its version', () => {
    db = openDatabase(':memory:');
    expect(db.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSION);
    expect(tableNames(db)).toEqual(['drafts', 'settings', 'templates', 'versions']);
  });

  it('is a no-op on an up-to-date database', () => {
    db = openDatabase(':memory:');
    db.prepare("insert into settings (key, value) values ('k', 'v')").run();
    migrate(db);
    expect(db.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSION);
    expect(db.prepare('select value from settings').pluck().get()).toBe('v');
  });

  it('refuses a database written by a newer build', () => {
    db = openDatabase(':memory:');
    db.pragma(`user_version = ${SCHEMA_VERSION + 1}`);
    expect(() => migrate(db!)).toThrow(NewerDatabaseError);
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
