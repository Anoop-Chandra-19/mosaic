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

- One database, `mosaic.db`, in the OS's local data folder (`databaseFolder.ts`):
  `%LOCALAPPDATA%\Mosaic` on Windows, `$XDG_DATA_HOME/Mosaic` (`~/.local/share/Mosaic`) on
  Linux, Application Support on macOS. Never a roaming or synced folder. Dev and e2e keep
  it in their own profile (`.dev-data/`, `--user-data-dir`). better-sqlite3, synchronous,
  WAL. Each `MosaicDb` call is one transaction, so a refusal writes nothing.
- The document is a JSON blob in one column. Do not normalize sections, entries, or bullets
  into rows — the whole document is always loaded, nothing queries across bullets, and the
  DDL would duplicate `src/shared/types/resume.ts`. SQL indexes the _history_: `templates`,
  `drafts` (one row per template), `versions` (`auto` | `named`), `settings`.
- Version documents live once each in `docs`, keyed by the sha-256 of their key-sorted
  JSON; `versions.doc_hash` points at them. Deleting or replacing templates ends with
  `deleteUnusedDocs`. Drafts keep their own copy.
- `templates.rev` bumps in the same transaction as every draft write. Whether the newest
  version still holds the draft is decided by comparing documents, never revs alone: a
  save or a backup can bring different content at the same rev. Naming a draft the newest
  version holds renames that version rather than adding one; if only the rev moved, the
  version adopts it, which makes the draft clean again. Every
  template has at least one version; zero templates is valid.
- Versions are appended, and undo moves the draft alone. The user can name any version and
  delete any but the newest (`versionEdits.ts`). A version's number (`seq`, shown as v7)
  never changes, so deleting leaves a gap; its children link to its parent instead. Undo
  puts it back from main's memory, for this session only. The renderer decides when an
  auto version is taken (`useAutoSnapshot`, template switch, window close, each behind the
  user's snapshot settings); main writes it and describes what changed
  (`describeDraftChanges`).
- A number can be added to while it is the newest: a new row with the next `revision`
  (v7.1), never a rewrite. Main decides with `@shared/history/canAddToVersion`, by the
  work writing it: an editing session gets revisions until 45 minutes pass or a stop or
  "before" row closes it; the user's naming and the assistant's apply add only when asked.
  A revision's parent is the revision before it.
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
- Migrations run at boot, before the window exists, and block main: a slow one looks like
  Mosaic not opening. Schema-only ones (tables, columns, indexes) take milliseconds and
  need nothing more. One that rewrites data (every stored document, or a table rebuilt
  because SQLite can't alter a column) must first show the window with a short "Updating
  your data…" message, then run, and be timed against a heavy database before it ships.
  Resumes are upgraded as they are read (`migrateResume`), never at boot.

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
- Test (`model-providers/testApiKey.ts`) makes one request that costs no tokens. The key travels only in a
  header, never in a URL, and no result or error repeats it.

## The assistant's tables (`db/conversations/`)

A conversation is an append-only log of messages, each a JSON `MessageBody`
(`src/shared/types/agentConversation.ts`) checked before it is written and never changed
after. Bodies must stay readable forever: change them only by adding (new optional
fields, new types), with a frozen fixture per type in its tests. The renderer reads the
log in pages, never whole. At boot, a run still marked running failed, and its pending
tool calls get error results. Deleting a conversation is a real `DELETE`, `VACUUM`, and
WAL checkpoint, not a flag.

## Words

- **conversation:** the whole log. It isn't tied to a template; each run records the one
  open when it was sent.
- **run:** one ask and everything the assistant does for it, until it finishes, is
  stopped, or fails. Numbered by `seq` within its conversation. Not "turn", which could
  mean the user's, the assistant's, or a tool round.
- **step:** one model request and the tool round after it. A run has many.
- **message:** one entry in the log: the user's, the assistant's, tool results, or a note
  the app writes.
- **tool call:** one tool the model asked for in a step, with its own row for the trace.
- **rev:** the draft's edit counter, bumped by every edit. Templates, versions, runs and
  tool calls each record the rev they saw; comparing it with the draft's is how a clean
  draft, a stale save, and a stale read are told apart. Never shown to the user.
- **revision:** only on versions: the `.1` in v7.1, an addition to a version number
  (`seq`). Unrelated to `rev`.
