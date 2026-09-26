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
  queries. No `tailwind.config.js` or legacy plugins. One exception:
  `features/view-transitions/viewTransitions.css`, since `::view-transition-*`
  pseudo-elements and their keyframes can't be utilities.
- `className` for anything chosen from a known set, animations and transitions included;
  `style` (or `element.animate()`) only for values computed at runtime, like a dragged
  width or a scroll offset.
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

## View transitions

`features/view-transitions/` is the layer; features import from it, and it imports no
feature. An element joins with `className={cn(…, transitionClasses({ name, motion,
isActive }))}`:

- **name**: which element it is, on one element at a time;
- **motion**: how it moves (a `view-transition-class`), styled in `viewTransitions.css`,
  which names motions and directions only, never an element or a feature;
- **isActive**: which of two elements sharing a name holds it now, decided by the component;
- a **direction** (`TRANSITION_TYPE`, via `addTransitionType`) varies a motion.

A new name or motion is one entry in `transitionClasses.ts`, written out whole (Tailwind
only generates classes it finds spelled out). `useShownSurface` and `pageHandoff` list the
surfaces that replace the workspace and take the page; a new surface joins by being added.
Use a motion that exists before inventing one:

| Motion                              | For                                                 | Used by                     |
| ----------------------------------- | --------------------------------------------------- | --------------------------- |
| `surface-in`, `surface-out`         | A view fading in over the workspace, and out        | The history view            |
| `recede`                            | Stepping back behind a view, unchanged, returning   | The workspace               |
| `handoff`                           | The same thing moving between two boxes showing it  | The page: preview ↔ history |
| `step` + `step-back`/`step-forward` | Sliding the way a sequence runs, back from the left | The page between versions   |
| `slide-away` (to build)             | Leaving, with the space reclaimed                   | The sidebar toggle          |

- A view transition blocks input while it runs: use one for whole-view changes and moves
  between boxes; keep frequent or interruptible changes (zoom, folds, hovers) CSS.
- A name sits on one element at a time, or the browser skips the transition.
- A named element draws unclipped while it moves: name the clipped box that shows a thing,
  not a thing taller than its box.
- The old and new images add their light: fade them in lockstep, or give offset images
  `mix-blend-mode: normal`, or the frame dims or washes out mid-way.
- Zustand renders at once and only a transition's render animates: state from a store
  reaches a transition through a deferred value (`useShownSurface`), or local state is set
  inside `startTransition`.
- Load what the new state shows before it commits (`use()` or read first), or the
  transition lands on an empty frame.
- Reduced motion turns off every animation; the transition still happens.

Check one in two ways. `e2e/view-transitions.spec.ts` counts transitions, their types, and
that none was skipped; add to it for a new one. For how it looks, run it in the built app
(never `electron-vite dev`) with each animation's `playbackRate` at 0.1, screenshot at
fixed points, and chart each frame's mean brightness: a dip or spike is a flash the eye
catches at full speed. Slowing doesn't reach nested groups, and the preview's own timers
aren't slowed, so film those at full speed.
