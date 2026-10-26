# Electron — main process

Read with the root `CLAUDE.md`. This covers `src/main/` and its contract with preload.

## Process model

- The preload (`src/preload/`) is sandboxed and builds to CommonJS (`.cjs`). It is the only
  bridge: narrow, typed methods on `window.mosaic`, never raw IPC or Node. Channel names and
  the `MosaicDb` method list live in `src/shared/ipc/`, used by both sides.
- The window opens no popups (a child window would inherit the preload) and never navigates
  away; links open in the browser. Every IPC handler still checks `isAppFrame`, which
  refuses any frame but the app's own page.
- Handlers come in two parts: argument checks with no Electron import
  (`ipc/dbHandlers.ts`, `ipc/secretsHandlers.ts` — unit tests drive these directly), and a
  thin `ipc/register*Handlers.ts` file that puts them on `ipcMain`.
- One instance only (`requestSingleInstanceLock`): SQLite has a single writer.

## Database access (`db/`)

No ORM: `db/` is the layer every other module goes through, and ESLint enforces it.

- **Only `db/` talks to SQLite.** `prepare`, `transaction`, `pragma` and value imports of
  `better-sqlite3` stay there. Other modules hold the `Database` handle (a type import) only
  to pass it to `db/` functions. Tests may check what was stored with SQL.
- **One exported function is one domain operation, and it is atomic.** It runs its own
  transaction when it writes more than one row (nested ones become savepoints). Callers
  never wrap `db/` calls in a transaction: when writes must land together, that is a new
  `db/` function named for the operation (`startUserRun`, `storeToolAnswers`), not a
  transaction in the caller.
- **Domain types in and out.** Rows (`input_tokens`, `conversation_id`) never leave `db/`;
  select with aliases or map them. Refusals are `StorageError` codes.
- Files follow the tables and the work: `runs.ts`, `toolCalls.ts` for a table's own
  reads and writes; `runLog.ts` for an operation that writes several of them.

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

- Kept in the OS keychain (`@napi-rs/keyring`, async so a prompt never blocks main), or in
  main's memory when the user asks to forget the key on close. `window.mosaic.secrets` can
  save, check, and remove a key but has no way to read one; main makes every call that
  needs it. Saving checks the key with the provider first and keeps it only if it passes,
  unless the user saves without checking after the provider couldn't be reached.
- Main notes only which providers the keychain holds, with when each key was saved and last
  passed a check (`app.apiKeys`), so status never touches the keychain and opening Settings
  can't raise a prompt. A keychain that refuses a write counts as unavailable until the next
  launch; keys stay in memory, with a notice.
- On Linux without a Secret Service, @napi-rs/keyring silently writes to the kernel
  keyring, which forgets keys at logout. `osKeyring.ts` spots that in `/proc/keys`, undoes
  the write, and reports the keychain unavailable.
- The keychain service is `Mosaic (dev)` for unpackaged runs and `Mosaic` when installed.
  e2e launches have no D-Bus session, so they never reach the desktop's keychain.
- macOS ties keychain access to the code signature: release builds need a stable signing
  identity, or users are asked again after each update.
- A check (`model-providers/testApiKey.ts`) lists the models the key can use
  (`listModels.ts`, chat models only; for OpenRouter, ones that call tools), which costs no
  tokens. Settings warns from that list when it lacks the model in settings. Main keeps each key's
  last list in memory until Mosaic closes. The key travels only in a
  header, never in a URL, and no result or error repeats it.

## Model providers (`model-providers/`)

- **Only `model-providers/` talks to a provider.** It alone imports a provider's SDK
  (`openai`) or Node's HTTP modules; the rest of main hands it Electron's `net.fetch`.
  SDK types stay inside too. `bun run check:deps` enforces it.
- An adapter returns our `ModelStreamEvent`s and `ModelProviderError`s and never throws. It
  keeps the provider's message and HTTP status, and sorts its errors by a table (a refused
  key is `keyRefused`), so the pane never guesses from a status.
- Each SDK client is made with `maxRetries: 0` (the loop retries, so the attempts show and
  are stored), a request timeout, the run's signal on each request, and every setting the
  SDK would take from the environment given: only Settings decides where requests go.
- No HTTP client of our own; the loop's stall check covers every provider's stream.

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
