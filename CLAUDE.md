# Mosaic — Modular Resume Builder

## Tech Stack

- Ships as a local desktop app bundled with Electron, not a hosted website.
  Everything stays on the user's machine; there is no server to migrate data on.
- React 19 + TypeScript, Vite, Tailwind CSS v4 (CSS-first, no tailwind.config.js)
- Zustand (with `persist` middleware) for state management
- Radix UI / shadcn (new-york style, zinc base) for primitives — don't hand-roll UI components
- Lucide for icons
- `@/` path alias maps to `src/`

## Commands

- `bun run dev` — start dev server
- `bun run build` — type-check + build
- `bun run lint` — ESLint
- `bunx shadcn@latest add <component>` — add a shadcn component

## Git Hooks (enforced)

- **pre-commit**: lint-staged (runs ESLint + Prettier on staged files)
- **commit-msg**: commitlint with conventional commits (`feat:`, `fix:`, `refactor:`, etc.)

## Project Structure

```
src/
  components/
    ui/           # shadcn-managed primitives — do NOT edit manually
    *.tsx         # Shared reusable components (ConfirmDeleteDialog, ItemActionsMenu, etc.)
  features/
    shell/        # App chrome (AppShell, TopBar, Sidebar, PreviewPanel)
    editor/       # Resume editing UI (ContentTab, SectionList, EntryCard, etc.)
    preview/      # Resume preview (ResumePreview, PreviewHeader, etc.)
    settings/     # Settings dialog + sections
  stores/         # Zustand stores
  types/          # Shared TypeScript types
  lib/
    hooks/        # Custom React hooks (useDarkMode, useResumeExport, etc.)
    export/       # Export utilities (PDF, markdown, plaintext)
    secrets/      # Secrets client
    utils.ts      # cn helper
    db.ts         # Dexie DB
    dexieStorage.ts
```

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
