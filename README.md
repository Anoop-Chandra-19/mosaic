# Mosaic

**A resume builder that keeps your data on your computer and lets you take it anywhere.**

Mosaic is a free, open-source desktop app for writing and tailoring your resume. There is
no account, no server, and no subscription. You open it and start writing.

## Why Mosaic

### Your data stays yours

- Everything is stored on your computer. Nothing is uploaded or synced.
- Backups are readable JSON with every template and its full history. Restore by replacing
  everything or adding alongside what you have.
- Export to PDF, Word (.docx), Markdown, plain text, JSON Resume, and Mosaic JSON. Your
  resume is never stuck in one place.
- Privacy controls let you forget API keys, reset the interface, or erase all local data.

### Built for tailoring

Most people keep one master resume and shape it for each job. Mosaic is built around that.

- Switch individual entries and bullets on or off without deleting them.
- Every template has version history: autosaved drafts, named versions, a preview before
  you restore one, and any version can become a new template.
- One source of truth, and as many tailored versions as you need.

### Import you can trust

Bring in a resume from PDF, Word (.docx), Markdown, plain text, JSON Resume, or pasted text.
It is read on your computer, and a review step shows what was found and what was left out
before anything is saved.

### What you see is what you export

- A live multi-page preview measures real page breaks, for A4 and US Letter.
- The header under your name is built from lines of items, each with its own text and link.
  Links stay clickable in every export, including real hyperlinks in Word.
- Word exports use real Word paragraph styles, so the document stays easy to edit.

### AI when you want it

AI is optional and off by default. The resume builder is complete without it. Configuration
for local models through Ollama is in place, and AI features are in progress.

### Who it's for

- People who want a good resume without paying for one.
- People applying to many jobs who need tailored versions quickly.
- Anyone who wants their work history to stay on their own computer.

## Tech Stack

- Electron 44 via electron-vite: main process, sandboxed preload, React renderer
- SQLite (better-sqlite3) in the main process for all data
- React 19 + React Compiler, TypeScript, Tailwind CSS v4 (CSS-first)
- Radix UI / shadcn primitives, Lucide icons
- Zustand for renderer state
- `@react-pdf/renderer` for PDF generation, pdf.js for reading PDFs back in
- Vitest for unit tests, Playwright (driving the real Electron app) for end-to-end tests

## Architecture

See [docs/architecture.md](docs/architecture.md) for the diagram: how the processes divide
the work, where data lives, and what crosses each boundary.

```text
src/
  main/           # Main process: window, database, IPC handlers, erase; see src/main/CLAUDE.md
    db/           # SQLite: connection, migrations, repositories
    ipc/          # Database and file-dialog handlers
  preload/        # The only bridge to the renderer: window.mosaic
  shared/
    ipc/          # Channel names shared by main and preload
    types/        # Cross-process contracts and data types; db.ts is the database contract
    resume/       # Defaults, migration, validation, header logic, section presets
    vault/        # Bundle parsing, used by renderer and main
    ai/           # Ollama address handling
  renderer/
    index.html    # Renderer entry HTML
    public/       # Static assets
    src/
      assets/     # Bundled assets
      components/ # Shared app components and shadcn primitives
      features/   # shell, editor, preview, templates, history, document-diff, import, export, backup, settings, start, agent
      stores/     # Zustand stores
      lib/        # Renderer domain logic and infrastructure (layout, storage bridge, …)
      types/      # Renderer-only types
      App.tsx
      index.css
      main.tsx
e2e/              # Playwright specs against the built app
```

`@/` maps to `src/renderer/src/`; `@shared/` maps to `src/shared/`. Shared modules are
environment-neutral contracts and logic, not React, DOM, or Electron implementations.
Unit tests live in a `__tests__/` folder beside the modules they cover; build output
remains in `out/`.

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

Every script below works with either (`npm run <script>`). See
[docs/development.md](docs/development.md) for development data, the React Compiler, and
end-to-end tests.

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

## License

[MIT](LICENSE)
