# Local motion

Read with the root and renderer `CLAUDE.md` files. This covers `lib/motion/` and its
consumers; `@/` means `src/renderer/src/`.

## Direction

Grow this as the app's small, shared local-animation foundation. Before adding an
animation, check its existing motions and lifecycle hooks. When a capability is
missing, extend the library with the smallest reusable behavior the feature needs,
built on native browser animation APIs, rather than duplicating it in the feature or
adding an animation dependency.

Components own content and visible state; the library owns programmatic motion,
interruption, cancellation, and exit retention. It knows boxes and rows, never features.
Every script duration is in `motionTiming.ts`; its easing matches the CSS theme.

Expand from actual use, not a speculative framework. Migrate existing custom motion
when that area is reworked, not in unrelated sweeps. Simple CSS transitions and
Radix-owned presence stay with their appropriate primitives; don't add feature-specific
tokens or keyframes to `index.css` for behavior the library can own.

Whole-view changes belong to `features/view-transitions/`, not this library; read its
`CLAUDE.md` before using that layer.

## Existing APIs

Use what exists before adding a motion:

- `useListMotion(signature, attribute)` for any list: rows marked with `attribute` slide,
  arrive, and leave through each change to `signature`, and the box eases to its height.
  `expect` swaps in another motion for the next change (a split's row travels from the
  text it came from); `useSwapMotion` covers a row changing what it shows, such as an
  editor opening. Typing never animates.
- `rowMotions.ts`: the motions themselves (slide, appear, leave, travel, fold, height,
  tint), for `expect` or a one-off.
- `usePresenceMotion(value, key, motion)` for content that comes and goes: render
  `shown`, key its element by the retained content, attach `ref`, and make it inert
  while `isLeaving`. Its second type parameter selects the element type (a div by
  default). It retains content through all exit animations and cancels stale exits
  on replacement. `presenceMotions.ts` supplies `pop` (the default) and `fade`;
  `staggerPresence.ts` supplies `stagger` for children of `data-presence-list` and
  an optional `data-presence-stretch`. Interrupted motions resume from each element's
  visible frame.
- `easeHeightChanges` (a ref callback) eases a box whose height follows its content, such
  as a dialog changing step; `recordPlaces` then `slideFromRecordedPlaces` slide items
  to where a layout switch put them.
- Folds are Radix collapsibles (`EditorFold`, `ReviewFold`); fixed motions, such as a
  split's seam, are CSS keyframes in `index.css`.

## Safety and validation

All motions stay inside the box's clipping, finish before the next change measures,
and never block input. With reduced motion nothing moves; colour fades stay. New
motions must respect reduced motion, clean up on unmount, and handle rapid changes
safely.

Test shared behavior with unit tests beside the library. Use focused browser tests
for lifecycle behavior that requires real animation APIs: exit retention, interrupted
motion, replacement, and reduced motion. Test the built Electron app, not Vite dev.
