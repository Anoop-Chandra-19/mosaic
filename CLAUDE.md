# Mosaic — Modular Resume Builder

## Tech Stack

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
    ui/         # shadcn-managed primitives — do NOT edit manually
    layout/     # App shell components (TopBar, Sidebar, PreviewPanel, AppShell)
    sidebar/    # Sidebar sub-components (SectionList, EntryCard, ContactCard, etc.)
    ai/         # AI-related components
    modals/     # Modal dialogs
    preview/    # Resume preview components
  stores/       # Zustand stores
  types/        # Shared TypeScript types
  lib/          # Utilities (cn helper, Dexie DB, custom hooks)
```

## Core Principles

### Responsive-first, no hardcoded pixel values

- All layouts MUST be responsive — use relative units (%, vw, rem, fr), clamp(), min(), max(), and container queries
- Pixel values are acceptable only as min/max floors/ceilings inside responsive expressions (e.g., `max(200px, 22vw)`)
- Before any commit, verify that layouts work across viewport sizes — nothing should overflow, collapse, or become unusable
- Use Tailwind container queries (`@container`) for component-level responsiveness

### General

- Keep components small and focused
- Zustand stores use `persist` middleware when state should survive reloads
- Persistence layer: Zustand → custom Dexie storage adapter → IndexedDB
- Don't add dependencies without asking
- Don't create new CSS files — use Tailwind utilities
- Don't modify files in `components/ui/` — those are shadcn-managed
- Tailwind v4: use CSS-first config, native container queries, `scrollbar-none`, etc. — no legacy plugin patterns

### UI Color Hierarchy (App Components)

- For app-owned components (`components/layout`, `components/sidebar`, `components/preview`, etc.), do not use opacity utilities for hierarchy (`text-*/..`, `bg-*/..`, `border-*/..`, `ring-*/..`, `opacity-*`)
- Use explicit tone steps instead (e.g., `zinc-100/300/500/900` or semantic tokens mapped to those tones) to express emphasis levels
- Keep hierarchy consistent: stronger titles/actions use higher-contrast tones; metadata and secondary copy use lower-contrast fixed tones
- Do not edit shadcn-managed files in `components/ui/`; if needed, adjust app-level usage or theme tokens instead
