# Mosaic — Modular Resume Builder

A local-first desktop resume builder. Everything stays on the user's machine; there is no
server, so whatever is on disk, the app itself must be able to read and upgrade.

## Tech Stack

- Electron 44 via electron-vite: main process in `electron/main/`, sandboxed preload in
  `electron/preload/`, renderer is `index.html` + `src/`. The renderer never gets Node or
  raw IPC — only `window.mosaic`: `db` (the `MosaicDb` contract, `src/types/db.ts`),
  `files` (system Save/Open dialogs run by main), `secrets` (API keys, write-only), `ai`
  (Ollama's pulled models — the renderer itself has no network), `app`.
- SQLite (better-sqlite3) in main holds everything the user makes. The schema, migrations,
  erase, and API keys are covered in `electron/CLAUDE.md`.
- React 19 + TypeScript, Vite, Tailwind CSS v4 (CSS-first, no `tailwind.config.js`),
  Zustand for renderer state.
- Radix UI / shadcn (new-york style, zinc base) for primitives — don't hand-roll UI
  components. Lucide for icons. `@/` maps to `src/`.

## Commands

The project works with both bun and npm (Node ≥ 22.18). Every `bun run <script>` is also
`npm run <script>`; `bunx` is `npx`.

- `bun run dev` — the app with Vite HMR. Unpackaged runs keep their whole profile in the
  repo's gitignored `.dev-data/`, never an installed Mosaic's `~/.config/Mosaic`.
- `bun run dev:reset` — quit the app, then run this to delete `.dev-data/`. Needed after
  editing `001_init.sql` (the app says so).
- `bun run build` — type-check and build main, preload, and renderer into `out/`.
  `bun run package` — build and package an installer into `release/`.
- `bun run test` — Vitest unit tests. `bun run lint` — ESLint.
- `bun run test:e2e` — build, then drive the real app with Playwright under `xvfb-run`
  (headless; Linux). Each launch gets a throwaway `--user-data-dir` and no D-Bus session,
  so runs never touch the real profile or the desktop's keychain. On macOS/Windows: build,
  then `bunx playwright test`.
- `bun run db:freeze` — release step; see `electron/CLAUDE.md`.
- `bunx shadcn@latest add <component>` — components arrive as upstream ships them,
  `import { cn } from "cn"` included (`@/lib/utils` re-exports it) — no import fix-ups.

### Dependencies

- Don't add dependencies without asking.
- `dependencies` is only for modules the main process loads at runtime (`better-sqlite3`,
  `@napi-rs/keyring`); electron-builder ships them. Everything the renderer uses goes in
  `devDependencies`, since Vite bundles it. `bunx shadcn add` installs into
  `dependencies` — move what it adds.
- Two lockfiles, kept in step: after any dependency change, run `bun install`, then
  `npm install --package-lock-only`, and commit both.
- No install scripts are needed (better-sqlite3 ships prebuilds; Electron downloads itself
  on first launch), so npm 11's list of skipped scripts is expected. `trustedDependencies`
  is bun's, for building better-sqlite3 where no prebuild exists.

## Git Hooks (enforced)

- **pre-commit**: lint-staged (ESLint + Prettier on staged files)
- **commit-msg**: commitlint with conventional commits (`feat:`, `fix:`, `refactor:`, etc.)

## Project Structure

```
e2e/              # Playwright specs over the built app (launch.ts; dialogs.ts stands in
                  #   for the system Save/Open dialogs)
electron/         # Main process, preload, shared channel names — see electron/CLAUDE.md
scripts/          # Release helpers (freeze-migrations)
src/
  components/ui/  # shadcn-managed primitives — do NOT edit
  components/     # Shared app components (ConfirmDeleteDialog, DialogFrame, …)
  features/       # One folder per area: shell, editor, preview, templates, import, export,
                  #   backup, settings, start, agent (the assistant pane; the loop goes in
                  #   electron/main/agent/)
  stores/         # Zustand stores
  types/          # App-wide types; db.ts, files.ts, secrets.ts are the bridge contracts
  lib/
    resume/       # Page metrics, contact formatting, validation, resume schema migration
    storage/      # Renderer side of the database: `getDb()`, `settingsStorage`
    vault/        # `parseBundle`: backup-file checks, run by the renderer and again by main
    files/        # File naming shared by export and backups
    hooks/        # Shared React hooks
```

### Code placement

- Keep a feature's components, hooks, helpers, types, and tests together in
  `src/features/<feature>/`. Code used by several screens can still belong to one feature.
- `src/lib/` is for shared domain logic and feature-independent infrastructure. Being pure,
  or being a hook, is not by itself a reason to move code there.
- `src/components/` for feature-independent UI, `src/stores/` for shared state,
  `src/types/` for app-wide types.
- Keep folders flat until subfolders help navigation, and tests next to what they cover.
  No layers or abstractions for hypothetical reuse.
- Apply these to new code, and improve placement in the area you are working on — but
  don't reorganize unrelated code just for consistency.

## Naming conventions

- Name the responsibility, not the implementation. Use domain terms (`resume`, `entry`,
  `draft`) rather than vague `doc`, `data`, or `item` when meaning would be lost.
- Functions: **verb + subject + useful qualifier** (`parseResumeLines`,
  `copyTextToClipboard`). Expose important effects (`parseAndMigrateStoredResume`);
  distinguish parsing, validation, formatting, and persistence. Include units when useful.
- Be explicit, not repetitive: `drafts.save()` and `saveDraft()` are both clear.
  Exported names need context; local names can be short. Don't lengthen clear names.
- Component files: PascalCase, matching the component (`ResumeHeaderCard.tsx`). Hooks and
  other TS modules: camelCase, matching the main operation (`useAddCustomSection.ts`,
  `renderResumePdf.tsx`) or subject + responsibility (`jsonResumeEntryMapping.ts`).
  Avoid catch-all `utils`, `helpers`, or `manager` modules; keep related functions together.
- Stores: `<subject>Store.ts`; type modules: domain names; unit tests: `<module>.test.ts`;
  folders: kebab-case. Use `.tsx` only for JSX. Keep tool-required and shadcn names unchanged.
- Types/components: PascalCase; functions/variables: camelCase; fixed module constants:
  SCREAMING_SNAKE_CASE. Treat acronyms as words (`Pdf`, `Ai`, `Db`, `Id`).
- Booleans: `is`/`has`/`can`/`should`; hooks: `use`; callback props: `onDeleteEntry`;
  event handlers: `handleDeleteEntry`; domain operations: `deleteEntry`.
- Apply to new code; migrate existing names separately, one area at a time. Update all
  references and run affected tests, build, and lint. Never rename persisted keys, database
  fields, IPC strings, or external-format fields as part of an internal naming cleanup.

## Data

- The renderer reaches data only through `window.mosaic` — domain methods, never SQL. Main
  checks every argument and answers a refusal with a `DbResult` code (`not-found`,
  `stale-rev`, `invalid-argument`).
- Documents never use zustand `persist`. `resumeStore` holds the open draft and saves it
  through `drafts.save` after a pause in typing; `flushDraft()` sends it at once. Anything
  that reads the draft from the database — switching, duplicating, importing, restoring,
  backing up — flushes first, and closing the window waits for it (up to 2 s).
- Preferences do persist: `uiStore` and `aiStore` over `settingsStorage` (the `settings`
  table, seeded at boot so stores hydrate before the first paint).
- The data is never locked in. A backup is a bundle (`src/types/bundle.ts`): readable JSON
  with every template, its draft, and its full history; Mosaic JSON export is the same for
  one template. Settings, AI configuration, keys, and conversations never go in a bundle.
- API keys never reach the renderer, the database, or a bundle.
- Resume schema, pre-v1: keep `CURRENT_SCHEMA_VERSION` at 1 and change `DEFAULT_RESUME` and
  the types directly — no migration steps. Keep the machinery (`lib/resume/migrateResume`):
  main runs every stored document through it, and `parseBundle` uses it to refuse files
  from a newer build. Start bumping with the first release real users install.

## Import

- `files.open('import')` hands the renderer a file's bytes; `readImportFile` picks the reader
  by extension: PDF, Word (.docx), Markdown, plain text, JSON Resume, or a Mosaic JSON
  backup (sent on to Restore). A file it can't read gets a message saying what to do
  (a scan, a password, an older .doc), shown in the dialog.
- Readers turn a file into `ImportLine`s (`importLines.ts`); `parseResumeLines` builds the
  resume from them. JSON Resume has fields that say what they are, so it skips the lines.
- Nothing is written before the review step, and nothing is dropped silently: text with no
  place goes in `leftOut`, doubts in `warnings`, and the dialog shows both.
- PDF and DOCX each have a folder (`import/pdf/`, `import/docx/`) split in two:
  `readPdf`/`readDocx` say only what the file holds; `pdfLines`/`docxLines` decide what it
  means. Keep guesses about meaning out of the readers.
- Files are untrusted. The zip and XML readers are ours, check their input strictly, and
  stop at written-down limits (`XML_LIMITS`, `PDF_LIMITS`, …). Readers run the same in the
  renderer and in Node tests: no DOM, no browser-only API. pdf.js is its legacy build in
  both, and in the app reads in a worker bundled with `?worker` (a URL worker under
  file:// becomes a blob: script the CSP refuses).
- Every export format has a round-trip test: export, import, and compare what the page
  shows. Mosaic's own PDF, Markdown, and JSON files come back exactly; plain text states
  its losses in its test. A DOCX export, when built, gets one too.
- Tests build their files (`buildDocx`, `buildPdf`, react-pdf). Never test against a real
  person's resume; `docx/__tests__/documents/` holds only fictional ones.

## Core Principles

### Responsive-first, no hardcoded pixel values

- Layouts use relative units (%, vw, rem, fr), `clamp()`, `min()`, `max()`, and container
  queries (`@container`). Pixels only as floors or ceilings inside those
  (e.g. `max(200px, 22vw)`).
- Desktop only: no phone layout. The window is never narrower than 720px (main's
  `minWidth`), so "narrow" means a small desktop window — editor and preview stay side by
  side. Before a commit, check nothing overflows or collapses across window sizes.

**The one exception is the resume page** (`features/preview/PreviewPage` and everything it
renders). A sheet of paper is a fixed artifact: the page is pinned to its exact point
dimensions as pixels, and the _container_ scales it with `transform: scale()` so the
preview's line wraps match the exported PDF's. Don't "fix" these to relative units, and
never use CSS `zoom` for the scaling — it re-runs layout and can re-wrap text.

### Resume format and layout

- `lib/resume/headlessLayout.ts` is the single source of truth for page metrics (margins,
  font sizes, leading, indents). The PDF export and the preview both read it; change a
  number there, not in a component.
- The "Headless Headhunter" format: section headers are the only bold text below the name;
  job and project lines are italic; text is black only. Never put `letter-spacing` or
  `text-transform: uppercase` on section headers — both break ATS text extraction.
- A section prints by its `layout` (`lines` or `entries`), never by its `kind`. The kind is
  meaning only — icon, importer headings, JSON Resume — and the built-in kinds are presets
  in `lib/resume/sectionPresets.ts`, any number of each; `custom` is a section the user
  named.
- Spacing comes from the 18pt leading grid. Margins between bullets or entries push the
  page off the grid, and the error compounds down the page.

### General

- Keep components small and focused.
- No new CSS files — Tailwind utilities, v4 CSS-first config, native container queries,
  no legacy plugins.
- Don't edit `components/ui/` (shadcn-managed); adjust the app's usage or theme tokens.
- In app-owned components, no opacity utilities for hierarchy (`text-*/..`, `bg-*/..`,
  `border-*/..`, `ring-*/..`, `opacity-*`). Use explicit tone steps (`zinc-100/300/500/900`
  or semantic tokens): stronger titles and actions get higher contrast, metadata and
  secondary copy lower.
