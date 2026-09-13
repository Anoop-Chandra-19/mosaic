/**
 * Release step: record the fingerprint of every migration that is about to ship in
 * `released.json`. From then on, a unit test fails if a released migration is edited —
 * users' databases already ran it, so changes must go in a new NNN_*.sql instead.
 */
import fs from 'node:fs';
import path from 'node:path';
// With its extension, so Node runs this file directly (`npm run db:freeze` or `bun run …`).
import { hashMigration, parseMigrations } from '../electron/main/db/migrationFiles.ts';

const dir = path.resolve(import.meta.dirname, '../electron/main/db/migrations');
const lockFile = path.join(dir, 'released.json');

const files = Object.fromEntries(
  fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.sql'))
    .map((name) => [name, fs.readFileSync(path.join(dir, name), 'utf8')])
);
const released = JSON.parse(fs.readFileSync(lockFile, 'utf8')) as Record<string, string>;

for (const { name, sql } of parseMigrations(files)) {
  const hash = hashMigration(sql);
  if (released[name] === undefined) {
    released[name] = hash;
    console.log(`froze ${name}`);
  } else if (released[name] !== hash) {
    console.error(`${name} changed after it was released. Revert it and add a new migration.`);
    process.exit(1);
  }
}

fs.writeFileSync(lockFile, `${JSON.stringify(released, null, 2)}\n`);
