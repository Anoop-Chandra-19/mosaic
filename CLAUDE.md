# Mosaic — Modular Resume Builder

## Tech Stack

- Ships as a local desktop app bundled with Electron, not a hosted website.
  Everything stays on the user's machine; there is no server to migrate data on.
- Electron 44 via electron-vite: main process in `electron/main/`, sandboxed preload in
  `electron/preload/` (the only bridge — `window.mosaic`), renderer is `index.html` + `src/`.
  The renderer never gets Node or raw IPC; the preload exposes narrow, typed methods.
- React 19 + TypeScript, Vite, Tailwind CSS v4 (CSS-first, no tailwind.config.js)
- Zustand (with `persist` middleware) for state management
- Radix UI / shadcn (new-york style, zinc base) for primitives — don't hand-roll UI components
- Lucide for icons
- `@/` path alias maps to `src/`

## Commands

- `bun run dev` — launch the Electron app with Vite HMR for the renderer. Unpackaged runs
  (`dev`, `preview`) keep their whole profile, `mosaic.db` included, in the repo's gitignored
  `.dev-data/`, never in an installed Mosaic's `~/.config/Mosaic`.
- `bun run dev:reset` — quit the app, then run this to delete `.dev-data/` and start fresh.
  Needed after editing `001_init.sql` (the app tells you): a database never re-runs a migration.
- `bun run db:freeze` — release step; see "Schema versioning".
- `bun run build` — type-check + build main, preload, and renderer into `out/`
- `bun run package` — build + package an installer with electron-builder into `release/`
- `bun run test` — Vitest unit tests
- `bun run test:e2e` — build, then drive the real Electron app with Playwright under
  `xvfb-run` (headless; Linux). Each launch gets a throwaway `--user-data-dir`, so e2e
  runs never touch the real profile. On macOS/Windows: build, then `bunx playwright test`.
- `bun run lint` — ESLint
- `bunx shadcn@latest add <component>` — add a shadcn component. Components come as
  upstream ships them, `import { cn } from "cn"` included (shadcn's `cn` package;
  `@/lib/utils` re-exports the same function for app code) — no import fix-ups.

### Dependencies

- `dependencies` is only for modules the **main process** loads at runtime (today
  `better-sqlite3`, `@napi-rs/keyring`) — electron-builder ships them as `node_modules`.
- Everything the renderer uses (React, Radix, react-pdf, …) goes in `devDependencies`:
  Vite bundles it into `out/renderer`, so shipping it again would only bloat the installer.
  `bunx shadcn add` installs into `dependencies` — move what it adds.

## Git Hooks (enforced)

- **pre-commit**: lint-staged (runs ESLint + Prettier on staged files)
- **commit-msg**: commitlint with conventional commits (`feat:`, `fix:`, `refactor:`, etc.)

## Project Structure

```
e2e/              # Playwright specs that launch the built app (launch.ts: withApp helper)
electron/
  main/           # Electron main process (window, lifecycle; secrets later)
    db/           # SQLite (better-sqlite3): connection, migrations/*.sql, repositories, tests
  preload/        # Sandboxed preload — builds to CommonJS (.cjs); the only renderer bridge
src/
  components/
    ui/           # shadcn-managed primitives — do NOT edit manually
    *.tsx         # Shared reusable components (ConfirmDeleteDialog, ItemActionsMenu, etc.)
  features/
    shell/        # App chrome (AppShell, TopBar, Sidebar, PreviewPanel)
    editor/       # Resume editing UI (ContentTab, SectionList, EntryCard, etc.)
    import/       # Import dialog, parsing, store application, and tests
    export/       # Export dialog, workflow, formatters, PDF generation, and tests
    templates/    # Template UI, status, and comparison logic
    preview/      # Resume preview (ResumePreview, PreviewHeader, etc.)
    settings/     # Settings dialog + sections
  stores/         # Zustand stores
  types/          # Shared TypeScript types
  lib/
    hooks/        # Shared React hooks (useDarkMode, useTemporaryState, etc.)
    files/        # File naming and download helpers shared by export and vault
    resume/       # Shared layout, contact formatting, and resume schema migration
    template/     # Shared template persistence schema migration
    storage/      # Storage backend, Dexie DB, adapters, and tests
    vault/        # Backup serialization, validation, and restore
    secrets/      # Secrets client
    utils.ts      # cn helper
```

### Code placement

- Keep feature-specific components, hooks, helpers, types, and tests together in
  `src/features/<feature>/`. Feature folders are not limited to UI components.
- Use `src/lib/` for shared domain logic, infrastructure, and feature-independent
  utilities. A function being pure, or a file containing a hook, is not by itself
  a reason to put it in `lib/`.
- Code used by multiple screens can still belong to one feature. Keep it with
  that owner rather than moving it into a shared folder solely because it has
  multiple consumers.
- Use `src/components/` for feature-independent reusable UI, `src/stores/` for
  shared application state, and `src/types/` for application-wide types.
- Keep feature folders flat until subfolders improve navigation, and keep tests
  near the code they cover. Do not add layers or shared abstractions for
  hypothetical future reuse.
- Apply these rules to new code and make existing placement improvements when
  working on the relevant area; do not reorganize unrelated code just for consistency.

## Core Principles

### Responsive-first, no hardcoded pixel values

- All layouts MUST be responsive — use relative units (%, vw, rem, fr), clamp(), min(), max(), and container queries
- Pixel values are acceptable only as min/max floors/ceilings inside responsive expressions (e.g., `max(200px, 22vw)`)
- Before any commit, verify that layouts work across viewport sizes — nothing should overflow, collapse, or become unusable
- Use Tailwind container queries (`@container`) for component-level responsiveness

**One documented exception: the resume page itself** (`features/preview/PreviewPage`
and everything it renders). A sheet of paper is a fixed artifact, so the page is
pinned to its exact point dimensions rendered as pixels, and the _container_
scales it visually with `transform: scale()` rather than reflowing it. This is
the only way the preview's line wraps can match the exported PDF's. Do not
"fix" these to relative units — that silently breaks WYSIWYG. Use `transform`,
never CSS `zoom`, for that scaling: `zoom` re-runs layout and can re-wrap text.

### Schema versioning

- Pre-v1: keep `CURRENT_SCHEMA_VERSION` at 1 and do not add migration steps.
  There are no users yet, so the stored shape can change freely — edit
  `DEFAULT_RESUME` and the types directly rather than writing a migration.
- Keep the migration machinery itself (`lib/resume/migrateResume`,
  `lib/template/migrateTemplateState`). It is a no-op today, but this ships as a
  local app with no server to backfill, so once real resumes exist on disk the
  version field is the only way to upgrade them. `lib/vault/parseVault` also uses
  it to reject vault files written by a newer build.
- Start bumping the version with the first release that real users install.
- The same rule covers the SQLite schema: pre-v1, edit `electron/main/db/migrations/001_init.sql`
  in place (and `bun run dev:reset`). From the first release, add `002_description.sql`
  instead — any `NNN_*.sql` in that folder is picked up automatically; numbers must run
  001, 002, … with no gaps. `migrate.ts` tracks progress with `PRAGMA user_version` and
  fingerprints each applied file: a dev launch stops on an edited migration and says to
  run `bun run dev:reset`.
- Releasing: run `bun run db:freeze` to record the shipping migrations in
  `migrations/released.json`. After that, `bun run test` fails if a released migration
  is edited — users' databases already ran it, so put the change in a new file.

### Resume format and layout

- `lib/resume/headlessLayout.ts` is the single source of truth for page metrics
  (margins, font sizes, leading, indents). Both the PDF export and the on-screen
  preview read it, so they cannot drift. Change a number there, not in a component.
- The output follows the "Headless Headhunter" resume format. Section headers are
  the only bold text below the name; job and project lines are italic; text is
  black only. Never apply `text-transform: uppercase` or `letter-spacing` to
  section headers — both mangle the text extraction that ATS parsers depend on.
- Spacing comes from the 18pt leading grid. Adding margins between bullets or
  entries pushes the page off that grid and compounds down the page.

### General

- Keep components small and focused
- Zustand stores use `persist` middleware when state should survive reloads
- Persistence layer: Zustand → custom Dexie storage adapter → IndexedDB
- Don't add dependencies without asking
- Don't create new CSS files — use Tailwind utilities
- Don't modify files in `components/ui/` — those are shadcn-managed
- Tailwind v4: use CSS-first config, native container queries, `scrollbar-none`, etc. — no legacy plugin patterns

### UI Color Hierarchy (App Components)

- For app-owned components (`features/shell`, `features/editor`, `features/preview`, etc.), do not use opacity utilities for hierarchy (`text-*/..`, `bg-*/..`, `border-*/..`, `ring-*/..`, `opacity-*`)
- Use explicit tone steps instead (e.g., `zinc-100/300/500/900` or semantic tokens mapped to those tones) to express emphasis levels
- Keep hierarchy consistent: stronger titles/actions use higher-contrast tones; metadata and secondary copy use lower-contrast fixed tones
- Do not edit shadcn-managed files in `components/ui/`; if needed, adjust app-level usage or theme tokens instead
