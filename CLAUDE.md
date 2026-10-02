# Mosaic — Modular Resume Builder

Local-first Electron app. Everything stays on the user's machine; there is no server.
The app must be able to read and upgrade everything it writes to disk.

## Read guidance for the area you change

`AGENTS.md` symlinks to `CLAUDE.md` at each scope; edit only the canonical `CLAUDE.md`.
Paths below are relative to the repository root. Read the relevant files before editing:

- Main, preload, IPC, SQLite, migrations, or secrets: `src/main/CLAUDE.md`.
- Renderer UI, state, or styling: `src/renderer/CLAUDE.md`.
- Import readers, parsing, or review: `src/renderer/src/features/import/CLAUDE.md`.
- Resume schema, header, sections, preview, import, or export: `docs/resume-format.md`.
- Setup, full source tree, and scripts: `README.md`.
- Development data, React Compiler background, and e2e details: `docs/development.md`.

## Architecture and boundaries

- Electron 44 + electron-vite: `src/main/`, sandboxed `src/preload/`, and
  `src/renderer/index.html` + `src/renderer/src/`. Root `e2e/` tests the whole built app;
  `scripts/` holds release helpers and three checks run by hand, never in CI: the agent evals
  (`scripts/agent-evals/`, with your own keys), the page-break sweep
  (`scripts/page-break-sweep/`, needs LibreOffice), and the typing check
  (`scripts/typing-check/`, whether the live preview keeps up). Build output is `out/`.
- React 19 + React Compiler, TypeScript, Tailwind v4, Zustand, Radix/shadcn, Lucide.
  `@/` maps to `src/renderer/src/`; `@shared/` maps to `src/shared/`.
- Renderer has no Node, raw IPC, or network. Use only `window.mosaic`: `db`, `files`
  (main's Save/Open dialogs), `secrets` (write-only keys), `ai` (Ollama's pulled models),
  and `app`. Main owns SQLite and validates every argument; database refusals use
  `DbResult` codes (`not-found`, `stale-rev`, `invalid-argument`).
- `src/shared/` is for environment-neutral contracts and logic used across processes:
  no React, DOM, or Electron implementations. Renderer-only code stays in the renderer.
- Keep feature code and tests together, folders flat until subfolders help navigation,
  and abstractions driven by actual reuse. Don't reorganize unrelated code.
- Unit tests go in a `__tests__/` folder beside the code they cover, never directly beside
  the module; test-only helpers and fixtures live there too. Root `e2e/` holds Playwright specs.

## Commands and dependencies

Bun and npm both work (Node ≥ 22.18): `bun run <script>` = `npm run <script>`;
`bunx` = `npx`.

- `bun run build` — type-check and build all three processes.
- `bun run test` — Vitest. `bun run lint` — ESLint.
- `bun run test:e2e` — build + Playwright. Linux needs `Xvfb`; each worker owns a separate
  virtual X11 desktop (no outer `xvfb-run`). Linux defaults to 4 workers, other platforms to 1;
  override with `--workers=N`. Each launch must use a throwaway `--user-data-dir` and no
  D-Bus session on Linux: never the real profile or keychain. Import `test` from
  `e2e/launch.ts`; manual launches use the `launchApp` fixture, not a standalone function.
- `bun run dev` uses the gitignored `.dev-data/`, never installed Mosaic's profile.
  Quit the app before `bun run dev:reset`, which deletes that development data.
- `bun run db:freeze` is a release step, not validation; see `src/main/CLAUDE.md`.
- Don't add dependencies without asking. Only main-process runtime modules belong in
  `dependencies` (`better-sqlite3`, `@napi-rs/keyring`); renderer modules go in
  `devDependencies` because Vite bundles them.
- After dependency changes, run `bun install`, then `npm install --package-lock-only`;
  include both lockfiles. No install scripts are needed; npm 11 skipped-script notices
  are expected. Bun's `trustedDependencies` allows better-sqlite3 builds without prebuilds.
- Hooks enforce ESLint + Prettier on staged files and conventional commit messages.

## Data safety

- Documents never use Zustand `persist`. `resumeStore` autosaves through `drafts.save`;
  `flushDraft()` saves immediately. Flush before any database read of the current draft
  (switch, duplicate, import, restore, backup). Window close waits for it, up to 2 seconds.
- Preferences use `uiStore` / `aiStore` with `settingsStorage`; main seeds the settings
  before the stores hydrate and the first paint.
- Bundles (`src/shared/types/bundle.ts`) are readable JSON: every template, its draft,
  and full history. Mosaic JSON exports the same for one template. Never include settings,
  AI configuration, keys, or conversations. API keys never reach the renderer or database.
- Pre-v1 resume schema: keep `CURRENT_SCHEMA_VERSION` at 1; edit `DEFAULT_RESUME` and types
  directly, without migration steps. Keep `migrateResume.ts`: main runs every stored resume
  through it, and `parseBundle` refuses newer schemas. Start version bumps at first release.
- Never use a real person's resume as a test fixture; build fictional test files.

## Naming

- Name responsibilities using domain terms (`resume`, `entry`, `draft`), not vague
  `doc` / `data` / `item` where meaning would be lost.
- Functions: verb + subject + useful qualifier (`parseResumeLines`, `copyTextToClipboard`).
  Expose important effects (`parseAndMigrateStoredResume`); distinguish parsing, validation,
  formatting, and persistence. Include units when useful. Be explicit, not repetitive:
  `drafts.save()` and `saveDraft()` are both clear; local names can be short.
- Component files: PascalCase matching the component. Other TS modules: camelCase matching
  the main operation or subject + responsibility. Avoid catch-all utils/helpers/manager files.
- Stores: `<subject>Store.ts`; type modules: domain names; tests: `__tests__/<module>.test.ts`;
  folders: kebab-case. Use `.tsx` only for JSX; keep tool-required and shadcn names unchanged.
- Types/components: PascalCase; functions/variables: camelCase; fixed module constants:
  SCREAMING_SNAKE_CASE. Acronyms are words (`Pdf`, `Ai`, `Db`, `Id`).
- Booleans: `is`/`has`/`can`/`should`; hooks: `use`; callbacks: `onDeleteEntry`;
  handlers: `handleDeleteEntry`; domain operations: `deleteEntry`.
- Apply to new code; rename existing code separately, one area at a time, updating references
  and running affected tests, build, and lint. Never rename persisted keys, database fields,
  IPC strings, or external-format fields as an internal naming cleanup.

## Structure

Someone new should understand a module, and how its files connect, in about 30 minutes.

- One responsibility per file, and the name says it: `diffResumes.ts` diffs resumes. If the
  honest description needs "and", it is two files; if it is a few lines only one file uses,
  it stays in that file. Never split just to make files smaller.
- A folder is a module, kept flat and imported file by file: no `index.ts` barrels, and no
  folder or file names that repeat in every module (`internal/`, `utils`). A subfolder is
  named for what it holds, and only once it helps navigation.
- A module's main file opens with a short comment: what the module is for, the path data
  takes through its files, and which files other modules use. Other modules import only
  those; the rest are its steps and may change freely. Update the comment with the files.
- Dependencies point one way: a module's main functions use its steps, steps use types and
  shared helpers, and nothing imports back up. No import cycles, type-only ones included.
- The same between layers: `main` and `renderer` use `shared`, never each other; in the
  renderer, `features` → `components` → `stores` → `lib` and `types`.
- Types live with the code that produces them, unless several modules share them: then
  `src/shared/types/` across processes, `src/renderer/src/types/` within the renderer.
- Apply to new modules, and to existing ones when they are next reworked.

## Readability

- One job per function. When a function needs comments to mark its steps, make the steps
  named functions, so the top-level one reads as the list of steps.
- Closures in a long function that don't need its state become top-level functions with
  explicit inputs.
- Don't pack meaning into a string to split it apart later (`"extra:bullet"`); build the
  object once.
- Per-case wording or settings go in a table (`Record<Kind, …>`), not an `if`/`else` chain.
  At most one level of ternary.
- Short names (`n`, `i`, `a`) only in a few lines or a math loop. Elsewhere, name what it
  holds: `printedBefore`, not `was`.
- Write an algorithm once and share it.
- A readability refactor changes no behavior: prove it against the old code with the tests,
  or a before/after comparison of outputs where tests don't reach.
