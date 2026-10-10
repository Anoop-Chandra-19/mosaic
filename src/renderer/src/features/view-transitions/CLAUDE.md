# View transitions

Read with the root and renderer `CLAUDE.md` files. This covers the view-transition layer
and its consumers; `@/` means `src/renderer/src/`.

Use this layer for whole-view changes and moves between boxes. A view transition blocks
input while it runs: keep frequent or interruptible changes local (CSS or `lib/motion/`).
Read `lib/motion/CLAUDE.md` for local motion.

## Joining a transition

Features import from this layer, and it imports no feature. An element joins with
`className={cn(…, transitionClasses({ name, motion, isActive }))}`:

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
| `slide-in`, `slide-away`            | Leaving to the edge, the space reclaimed, and back  | The sidebar, history index  |
| `reclaim`                           | A box easing into space given up beside it          | The history list            |

## Correctness

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
- An element named in every state animates on unrelated transitions too. Give its motion
  only to leaving and arriving with `:only-child` (the image has no pair); `:not()` isn't
  allowed after these pseudo-elements, so set the in-place default first and override it.
  For something that mounts and unmounts, React's `<ViewTransition enter exit>` names it
  only when it comes or goes.
- Reduced motion turns off every animation; the transition still happens.

## Validation

Check one in two ways. `e2e/view-transitions.spec.ts` counts transitions, their types, and
that none was skipped; add to it for a new one. For how it looks, run it in the built app
(never `electron-vite dev`) with each animation's `playbackRate` at 0.1, screenshot at
fixed points, and chart each frame's mean brightness: a dip or spike is a flash the eye
catches at full speed. Slowing doesn't reach nested groups, and the preview's own timers
aren't slowed, so film those at full speed.
