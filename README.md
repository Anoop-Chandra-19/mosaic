# Mosaic

Mosaic is a local-first, modular resume builder with a live print-style preview.

It is built for fast editing, precise content selection, and clean exports, while keeping user data on the user's machine.

## Current Status

Implemented today:

- Content editing for contact details, sections, entries, and bullets
- Include/exclude toggles for entries and bullets
- Live multi-page preview with measured pagination logic
- A4 and US Letter paper support
- PDF export, plus copy as Markdown and plaintext
- Persisted local state via Zustand + IndexedDB (Dexie)
- Responsive UI with desktop and mobile editing behavior

Scaffolded but not fully implemented yet:

- Templates panel logic
- AI settings and tools UI logic
- Resume import/parser flow
- Electron packaging and OS keychain integration

## Tech Stack

- React 19 + TypeScript
- Vite
- Tailwind CSS v4 (CSS-first)
- Radix UI / shadcn primitives
- Zustand state management (`persist` middleware)
- Dexie-backed IndexedDB persistence
- `@react-pdf/renderer` for PDF generation

## Architecture

```text
src/
  components/
    layout/   # App shell (TopBar, Sidebar, PreviewPanel)
    sidebar/  # Resume editing UI
    preview/  # Live resume preview + pagination rendering
    ui/       # shadcn/radix wrappers (shared primitives)
  stores/
    resumeStore.ts  # resume content data + CRUD actions
    uiStore.ts      # app UI state (theme, pane, paper size, sidebar)
  lib/
    db.ts           # Dexie database instance
    dexieStorage.ts # Zustand persist adapter -> IndexedDB
    export/         # export normalization + formatters + PDF
  types/
    resume.ts       # domain types
    ui.ts           # UI types (paper size, etc.)
```

## Data Flow

1. User edits content in sidebar components.
2. Sidebar components call actions in `resumeStore`.
3. `ResumePreview` subscribes to store state and rerenders immediately.
4. Export actions normalize selected content and route to PDF/Markdown/plaintext formatters.
5. Store state persists asynchronously to IndexedDB through Dexie.

## State and Persistence Model

- `resumeStore` holds resume data (`contact`, `sections`, `entries`, `bullets`).
- `uiStore` holds presentation state (theme, active tab, paper size, layout ratio, mobile pane).
- Both stores persist through Zustand `persist` using `createJSONStorage(() => dexieStorage)`.
- `dexieStorage` reads/writes stringified state to a key-value table in IndexedDB.

Current persisted keys:

- `mosaic-resume`
- `mosaic-ui`

## Privacy and Security Model

Current:

- Core app is local-first.
- Resume data and UI preferences stay in local IndexedDB.
- No backend is required for editing/preview/export.

Planned key handling for AI features:

- Web: API keys are session-only by default (memory, not persisted).
- Electron: API keys will use OS keychain-backed storage via secure preload IPC.
- API keys will get special handling and will not live in normal persisted app state.

## Development

Preferred runtime:

```bash
bun install
bun run dev
```

Alternative (npm):

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## Scripts

| Command           | Description                         |
| ----------------- | ----------------------------------- |
| `bun run dev`     | Start dev server                    |
| `bun run build`   | Type-check and build for production |
| `bun run preview` | Preview production build            |
| `bun run lint`    | Run ESLint                          |

## Commit Conventions

Conventional commits are enforced via Husky + commitlint.

Examples:

```text
feat: add AI provider router scaffold
fix: correct preview pagination split behavior
docs: align roadmap with implemented features
```

`pre-commit` runs ESLint and Prettier through `lint-staged`.
