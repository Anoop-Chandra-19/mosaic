# Electron — main process

Read with the root `CLAUDE.md`. This covers `src/main/` and its contract with preload.

## Process model

- The preload (`src/preload/`) is sandboxed and builds to CommonJS (`.cjs`). It is the only
  bridge: narrow, typed methods on `window.mosaic`, never raw IPC or Node. Channel names and
  the `MosaicDb` method list live in `src/shared/ipc/`, used by both sides.
- Every IPC handler checks `isAppFrame`: a PDF preview popup shares the preload but has no
  business in the database or the keys.
- Handlers come in two parts: argument checks with no Electron import
  (`ipc/dbHandlers.ts`, `ipc/secretsHandlers.ts` — unit tests drive these directly), and a
  thin `ipc/register*Handlers.ts` file that puts them on `ipcMain`.
- One instance only (`requestSingleInstanceLock`): SQLite has a single writer.

## SQLite

- One database, `userData/mosaic.db` (never a synced folder): better-sqlite3, synchronous,
  WAL. Each `MosaicDb` call is one transaction, so a refusal writes nothing.
- The document is a JSON blob in one column. Do not normalize sections, entries, or bullets
  into rows — the whole document is always loaded, nothing queries across bullets, and the
  DDL would duplicate `src/shared/types/resume.ts`. SQL indexes the _history_: `templates`,
  `drafts` (one row per template), `versions` (`auto` | `named`), `settings`.
- Version documents live once each in `docs`, keyed by the sha-256 of their key-sorted
  JSON; `versions.doc_hash` points at them. Deleting or replacing templates ends with
  `deleteUnusedDocs`. Drafts keep their own copy.
- `templates.rev` bumps in the same transaction as every draft write. The draft is clean
  when its rev matches the newest version's; naming a clean draft renames that version
  rather than adding one. A version the draft still holds word for word is never
  duplicated either: it adopts the draft's rev, which makes the draft clean again. Every
  template has at least one version; zero templates is valid.
- Versions are appended, never rewritten: undo moves the draft alone. The renderer decides
  when an auto version is taken (`useAutoSnapshot`, template switch, window close); main
  writes it and describes what changed (`describeDraftChanges`).
- `app.*` settings belong to main (`app.activeTemplateId`, `app.apiKeys`), and
  `db.settings` refuses them from the renderer. Boot sends every setting to the renderer,
  so none may hold a secret.
- Erase (`eraseAll.ts`) forgets the API keys, then deletes the database file and
  reopens it empty, so tables added later are wiped without anyone listing them. If a key
  won't go, the erase stops before the resumes do.

## Migrations

- Pre-v1: edit `db/migrations/001_init.sql` in place, then `bun run dev:reset`. From
  the first release users install, add `002_description.sql` instead — any `NNN_*.sql` in
  that folder is picked up; numbers run 001, 002, … with no gaps.
- `migrateDatabase.ts` tracks progress with `PRAGMA user_version` and fingerprints each applied
  file: a dev launch stops on an edited migration and says to run `bun run dev:reset`.
- Releasing: `bun run db:freeze` records the shipping migrations in
  `db/migrations/released.json`. After that, `bun run test` fails if a released migration is
  edited — users' databases already ran it, so the change goes in a new file.

## API keys (`secrets/`)

- Kept in the OS keychain (`@napi-rs/keyring`, async so a prompt never blocks main) or in
  main's memory for the session. `window.mosaic.secrets` can save, test, and remove a key
  but has no way to read one; main makes every call that needs it.
- Main notes only which providers the keychain holds (`app.apiKeys`), so status never
  touches the keychain and opening Settings can't raise a prompt. A keychain that refuses
  a write counts as unavailable until the next launch; keys stay in memory, with a notice.
- On Linux without a Secret Service, @napi-rs/keyring silently writes to the kernel
  keyring, which forgets keys at logout. `osKeyring.ts` spots that in `/proc/keys`, undoes
  the write, and reports the keychain unavailable.
- The keychain service is `Mosaic (dev)` for unpackaged runs and `Mosaic` when installed.
  e2e launches have no D-Bus session, so they never reach the desktop's keychain.
- macOS ties keychain access to the code signature: release builds need a stable signing
  identity, or users are asked again after each update.
- Test (`testApiKey.ts`) makes one request that costs no tokens. The key travels only in a
  header, never in a URL, and no result or error repeats it.

## Planned with the agent layer

In `plans/mosaic_sqlite_storage_plan.md`: conversations → runs → messages / tool_calls /
ops, stored as provider-neutral content blocks, one write per assistant message. Staged
suggestions persist and are revalidated against `rev`, and never enter `drafts` or
`versions`. Deleting a conversation is a real `DELETE`, `VACUUM`, and WAL checkpoint, not
a flag.
