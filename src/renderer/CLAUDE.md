# Renderer

Read with the root `CLAUDE.md`. This covers `src/renderer/`; `@/` means its `src/` folder.
For resume content, preview, or exports, also read `docs/resume-format.md` (repo-relative).

## Placement

- Keep a feature's components, hooks, helpers, types, and tests in `src/features/<feature>/`.
  Code used by several screens can still belong to one feature.
- `src/lib/` is renderer domain logic and feature-independent infrastructure. Being pure,
  or being a hook, is not by itself a reason to move code there or into `src/shared/`.
- `src/components/` is feature-independent UI; `src/stores/` is shared renderer state;
  `src/types/` is renderer-only types. Keep components small and focused.

## UI foundation

- Use Radix/shadcn primitives (new-york, zinc base), not hand-rolled equivalents.
  Use `@/components/AppButton` for app buttons; don't import the shadcn Button directly.
  Use the appropriate primitive for tabs, toggles, and other non-button semantics.
- Never edit `src/components/ui/` (shadcn-managed). Customize app wrappers, usage, or theme
  tokens instead. Lucide supplies icons.
- `bunx shadcn@latest add <component>` keeps upstream imports, including `cn` from `cn`
  (`@/lib/utils` re-exports it). Ask before adding dependencies; move the renderer packages
  shadcn adds from `dependencies` to `devDependencies` and synchronize both lockfiles.
- No new CSS files: use Tailwind v4 utilities, CSS-first config, and native container
  queries. No `tailwind.config.js` or legacy plugins.
- No opacity utilities for hierarchy in app-owned components (`text-*/..`, `bg-*/..`,
  `border-*/..`, `ring-*/..`, `opacity-*`). Use explicit tone steps or semantic tokens:
  stronger titles/actions get higher contrast, metadata/secondary copy lower.
- React Compiler handles eligible memoization. Write pure components and follow the Rules
  of React; don't add manual memoization by default or remove existing memoization blindly.
  Compiler optimization does not replace effect dependencies or Zustand subscriptions.

## Responsive layout

- Use relative units (%, vw, rem, fr), `clamp()`, `min()`, `max()`, and container queries.
  Pixels are allowed only as floors/ceilings inside those, e.g. `max(200px, 22vw)`.
- Desktop only, minimum window width 720px. Narrow means a small desktop window, not a
  phone layout: editor and preview stay side by side. Before committing UI changes,
  check for overflow or collapsed layouts across window sizes.
- **Resume pages are the exception:** `@/features/preview/PreviewPage` and its contents
  use exact point dimensions as pixels. Scale the container with `transform: scale()`;
  never CSS `zoom` or relative page dimensions, which can change line wraps versus PDF.
