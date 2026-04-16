# Mosaic

Mosaic is a local-first, modular resume builder with a live print-style preview.

It is built for fast editing, precise content selection, and clean exports, while keeping user data on the user's machine.

## Features

- Content editing for contact details, sections, entries, and bullets
- Include/exclude toggles for entries and bullets
- Live multi-page preview with measured pagination logic
- A4 and US Letter paper support
- PDF export, copy as Markdown and plaintext
- Persisted local state via Zustand + IndexedDB (Dexie)
- Responsive UI with desktop and mobile editing
- Settings workspace with Discord-style navigation
- Local privacy controls (clear keys, reset resume/UI, full local reset)
- AI config foundation (provider and model settings)

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
    ui/           # shadcn-managed primitives
    *.tsx         # Shared reusable components
  features/
    shell/        # App chrome (AppShell, TopBar, Sidebar, PreviewPanel)
    editor/       # Resume editing UI
    preview/      # Resume preview
    settings/     # Settings dialog + sections
  stores/         # Zustand stores
  types/          # Shared TypeScript types
  lib/
    hooks/        # Custom React hooks
    export/       # Export utilities (PDF, markdown, plaintext)
    secrets/      # Secrets client
    utils.ts      # cn helper
    db.ts         # Dexie database instance
    dexieStorage.ts # Zustand persist adapter -> IndexedDB
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

- Local-first — resume data and UI preferences stay in local IndexedDB.
- No backend is required for editing, preview, or export.
- API keys for AI features are session-only by default and are not persisted alongside app state.

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
