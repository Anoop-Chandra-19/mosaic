# View transitions

Read with the root and renderer `CLAUDE.md` files. `@/` means `src/renderer/src/`.

Use this folder for changing whole views or moving the resume page between views.
View transitions block input. Keep frequent or interruptible animations in CSS or
`lib/motion/`; read that folder's `CLAUDE.md` before using it.

## How it works

The browser displays before and after images of the UI and animates between them.
A **surface** is a view over the workspace: Start, history, or suggestion review.

Components use `transitionClasses({ name, motion, isActive })` in their `className`:

- **name** matches an element before and after the change, even across two views.
- **motion** chooses its animation from `viewTransitions.css`.
- **isActive** enables these classes. Only one rendered element may use each name.
- **type** changes an animation, such as sliding back instead of forward. Use
  `TRANSITION_TYPE` with React's `addTransitionType` or `changeInViewTransition`.

Features import from this folder; this folder must not import features.
CSS uses motion names, not element or feature names. Add complete class strings to
`transitionClasses.ts` so Tailwind can find them. Reuse a motion before adding one.

## Which file to use

- `useShownSurface.ts`: the view React is rendering. Use this instead of the raw store
  to let React animate view changes. It also lists views that replace the workspace.
- `surfaceAround.ts`: whether a matching view is requested, visible, or still closing.
- `pageHandoff.ts`: prepares the preview and transfers the page's transition name to
  history/review. Its sets list which views share the page and which open at fit zoom.
- `sideHandover.ts`: enables separate side-panel animations for review, not history.
- `useSettledSurface.ts`: the current view after its animation finishes; used by the tour.
- `whenViewTransitionsSettle.ts`: waits for the current transition to finish.
- `changeInViewTransition.ts`: animates updates React does not already animate.
  Its promise waits for the update, **not** for the animation to finish.

## Available motions

| Motion                              | What it does                                                  | Used for                    |
| ----------------------------------- | ------------------------------------------------------------- | --------------------------- |
| `surface-in`, `surface-out`         | Fade a view in or out                                         | History                     |
| `recede`                            | Shrink/fade the workspace, then restore it                    | Workspace                   |
| `handoff`                           | Move the page between containers                              | Preview ↔ history/review    |
| `handoff in-place`                  | Move the existing page without two images                     | Side-panel layout changes   |
| `step` + `step-back`/`step-forward` | Slide from the left/right                                     | Review page ↔ cards         |
| `slide-in`, `slide-away`            | Slide a panel left; `at-end` slides right                     | Side panels                 |
| `reclaim`                           | Resize into space beside a panel                              | History list                |
| `glide`                             | Move content without stretching; `at-end` aligns right        | Preview bar ends            |
| `crossfade` (type)                  | Fade between the UI before and after an update                | Tour ending; Apply and undo |
| `fade`                              | Fade an overlay                                               | History tour                |
| `lockstep`                          | Move a bar while cross-fading its content                     | Top bar ↔ review bar        |
| `handover-upper`, `handover-lower`  | Swap column content with a vertical push                      | Assistant ↔ inspector       |
| `cut`                               | No animation on the view itself; its parts animate separately | Review                      |
| `rise`                              | Move a bar up after a short delay, down when closing          | Review apply bar            |

## Rules that prevent visual bugs

- Duplicate transition names make the browser skip the transition.
- Name the visible clipping container, not overflowing content. Transition images are
  not clipped by the element's original ancestors.
- A named container with `ResumePreview` needs `contain-paint`. Otherwise the preview's
  off-screen measuring copy can make the captured image too large to display.
- Keep both fades in sync to avoid dimming. For sliding, overlapping images, use
  `mix-blend-mode: normal` so they do not become too bright.
- Store updates happen immediately. Use `useShownSurface` to defer view changes for React
  to animate, or `startTransition` for local state updates.
- Load the next view's content before committing it (`use()` or read ahead), or the
  animation can end on an empty view.
- Use `:only-child` for opening/closing animations. Here it means there is no matching
  before or after image. Set the normal rules first, then override with `:only-child`;
  `:not()` is not supported after these pseudo-elements. React's `<ViewTransition enter exit>`
  names mounting/unmounting elements only when they open or close.
- Delay overlays such as the tour until `useSettledSurface()` returns the view. Showing
  them during a transition can capture them in its images and cause a flash.
- Use `changeInViewTransition` when an overlay and the view behind it change together.
  Await its promise before reading the updated state, such as saving after Apply.
  Pass a step type for review's page/card switch. Cross-fades must not replay a column push.
- Both images use the incoming element's motion classes. For a column swap, `lower`
  means the inspector is opening; `upper` means the assistant is returning.
- A page/card step must not replay the inspector's vertical push.
- Use local motion (`lib/motion/stepIn.ts`) for repeated history-version key presses.
  View transitions would block each press.
- Use `useIsSideHandover` for side-panel transition names. Use `useIsSurfaceAround` to
  disable the preview bar's separate animations while any surface is opening, open, or closing.
- Animate the preview bar's ends separately with `glide`; one image would stretch the bar.
- Reduced motion disables animations, not the view change.

## Validation

`e2e/motion/view-transitions.spec.ts` checks transition counts, types, and skipped
transitions. Extend it when adding a transition.

For visual checks, use the built app, not `electron-vite dev`. Set animation `playbackRate`
to 0.1 and take screenshots at fixed times. Compare each frame's mean brightness to catch
flashes. Nested groups and the preview's own timers are not slowed this way; record those
at normal speed too.
