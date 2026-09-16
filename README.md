# Mosaic

Mosaic is a local-first, modular resume builder with a live print-style preview.

It is a desktop app (Electron) built for fast editing, precise content selection, and clean
exports. Everything stays on your machine: there is no account, no sync, and no server.

## Features

- Content editing for contact details, sections, entries, and bullets
- Include/exclude toggles for entries and bullets
- Live multi-page preview with measured pagination, A4 and US Letter
- Templates with version history: autosaved drafts, named versions, preview before restore,
  duplicate any version as a new template
- Export to PDF, Markdown, plain text, JSON Resume, and Mosaic JSON
- Import from PDF, Word (.docx), Markdown, plain text, JSON Resume, or pasted text, read on
  your machine, with a review step that shows what was found and what was left out before
  anything is written
- Full backups as readable JSON (every template and its history), restore by replacing
  everything or adding alongside
- Privacy controls: forget API keys, reset the interface, erase all local data
- AI configuration foundation (optional; off by default)

## Tech Stack

- Electron 44 via electron-vite — main process, sandboxed preload, React renderer
- SQLite (better-sqlite3) in the main process for all data
- React 19 + TypeScript, Tailwind CSS v4 (CSS-first)
- Radix UI / shadcn primitives, Lucide icons
- Zustand for renderer state
- `@react-pdf/renderer` for PDF generation, pdf.js for reading PDFs back in
- Vitest for unit tests, Playwright (driving the real Electron app) for end-to-end tests

## Architecture

```text
electron/
  main/           # Main process: window, database, IPC handlers, erase
    db/           # SQLite: connection, migrations, repositories
    ipc/          # Database and file-dialog handlers
  preload/        # The only bridge to the renderer: window.mosaic
  shared/         # Channel names shared by main and preload
src/
  features/       # shell, editor, preview, templates, import, export, backup, settings, start
  stores/         # Zustand stores
  lib/            # Shared domain logic (resume layout, storage bridge, bundle parsing, …)
  types/          # Shared types; db.ts is the database contract
e2e/              # Playwright specs against the built app
```

## Data and Privacy

- One SQLite database, `mosaic.db`, in the app's user-data folder. Only the main process
  opens it; the sandboxed renderer calls a small set of typed methods through the preload
  and never sees SQL, Node, or the file system.
- Each resume document is stored as JSON; SQL tracks templates, drafts, and version history.
- Your data is never locked in: backups and Mosaic JSON exports are plain, readable JSON.
- API keys are never written to the database or to backups.
- Erase local data deletes the database file itself.

## Development

With [bun](https://bun.sh):

```bash
bun install
bun run dev
```

Or with npm (Node 22.18 or newer):

```bash
npm ci
npm run dev
```

Every script below works with either (`npm run <script>`). Development runs keep their data in the repo's gitignored `.dev-data/`; `bun run dev:reset`
deletes it.

## Scripts

| Command             | Description                                         |
| ------------------- | --------------------------------------------------- |
| `bun run dev`       | Launch the app with hot reload                      |
| `bun run dev:reset` | Delete development data and start fresh             |
| `bun run build`     | Type-check and build main, preload, and renderer    |
| `bun run package`   | Build an installer into `release/`                  |
| `bun run test`      | Unit tests                                          |
| `bun run test:e2e`  | Build, then run end-to-end tests headlessly (Linux) |
| `bun run lint`      | Run ESLint                                          |

## Commit Conventions

Conventional commits are enforced via Husky + commitlint.

```text
feat: add AI provider router scaffold
fix: correct preview pagination split behavior
docs: align roadmap with implemented features
```

`pre-commit` runs ESLint and Prettier through `lint-staged`.
