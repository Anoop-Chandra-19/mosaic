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

| Motion                               | For                                                 | Used by                                                 |
| ------------------------------------ | --------------------------------------------------- | ------------------------------------------------------- |
| `surface-in`, `surface-out`          | A view fading in over the workspace, and out        | The history view                                        |
| `recede`                             | Stepping back behind a view, unchanged, returning   | The workspace                                           |
| `handoff`                            | The same thing moving between two boxes showing it  | The page: preview ↔ history                             |
| `step` + `step-back`/`step-forward`  | Sliding the way a sequence runs, back from the left | Versions; page ↔ cards                                  |
| `slide-in`, `slide-away` (+`at-end`) | Leaving to the edge, the space reclaimed, and back  | Sidebar, history index; the assistant pane at the right |
| `reclaim`                            | A box easing into space given up beside it          | The history list                                        |
| `glide` (+`at-end`)                  | Moving to its new place, held by one edge, unscaled | The preview bar's two ends, as the side panels move     |
| `crossfade` (a type, on the root)    | A store change's before and after, as one image     | Tour ending; Apply and undo                             |
| `fade`                               | A layer over the app arriving or leaving whole      | The history tour's veil                                 |
| `lockstep`                           | One box whose content changes, both images in step  | Top bar ↔ review bar                                    |
| `handover-upper`, `handover-lower`   | Two stacked in one box: one leaves up, one rises    | Assistant pane ↔ inspector                              |
| `cut` (React enter/exit)             | What's left of a surface whose parts all move       | The suggestion review                                   |
| `rise`                               | A bar coming in once the view under it has landed   | The review's apply bar                                  |

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
- A layer painted over the app (a tour's veil) is caught in a running transition's images
  and painted again when it ends, which flashes. One that arrives with a surface shows on
  `useSettledSurface()`, the surface once its transition has finished, not on the store.
  A store change that swaps what a layer covers goes through `changeInViewTransition`, so
  the two cross-fade as one image instead of painting in turn. It takes another type for a
  change inside a surface whose own updates don't animate (the review's Compare all steps).
  The change runs a frame later: await its promise before anything that reads the result
  (Apply writes its version after it lands). In a cross-fade, a handed-over column swaps in
  lockstep rather than pushing.
- A step moves only what steps: a handed-over column (`handover`) in the same transition
  holds still.
- A pair's old and new images both carry the arriving element's classes, so a class can't
  say which image moves which way. Say it by which element arrives (`handover-lower`
  arriving is the review opening), or with a type.
- A named box holding a `ResumePreview` needs `contain-paint`: the preview's measuring
  copy is fixed far off-screen, and stretches the box's image until it draws blank.
- `useIsSideHandover` names the sidebar and the assistant pane only while a surface that
  takes the sides is coming or going, so the history (which takes the workspace whole)
  never moves them. Both are `useIsSurfaceAround`, which the preview bar uses the other way
  round: its ends glide only while no surface is around, so they never leave the workspace.
- A bar with parts on both sides never moves as one image: its parts move in different
  directions at once and it looks like jelly. Name each end, and let each `glide`.
- Reduced motion turns off every animation; the transition still happens.

## Validation

Check one in two ways. `e2e/view-transitions.spec.ts` counts transitions, their types, and
that none was skipped; add to it for a new one. For how it looks, run it in the built app
(never `electron-vite dev`) with each animation's `playbackRate` at 0.1, screenshot at
fixed points, and chart each frame's mean brightness: a dip or spike is a flash the eye
catches at full speed. Slowing doesn't reach nested groups, and the preview's own timers
aren't slowed, so film those at full speed.
