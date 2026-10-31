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
- A feature imports another feature only to show its screen or call an action it owns. A
  helper several features use leaves the feature that wrote it first: `src/lib/` is the
  renderer's own common code; `src/stores/` if it reads a store; `src/components/` if it is
  UI or DOM behaviour that reads one. Only code more than one process uses goes in the root
  `src/shared/`.

## Shared state

Each store holds one kind of state; put new state with its kind, not in the nearest store.

- `overlayStore`: what covers the app. A surface over the workspace, Settings, one
  `dialog` (`openDialog({ kind, … })`, `closeDialog(kind)`; a dialog reads itself with
  `useDialog(kind)`), and one `tour`. A new dialog is a `DialogRequest` kind, never a flag.
- `previewStore`: the version being read in the sheet, its marks, and the page count.
- `toastStore`: `showToast`, and `attempt` for an action that may fail.
- `targetStore`: a shortcut that opens or focuses something drawn inside a feature is a
  keyboard target (`requestTarget`, answered by `useTargetRequest` where it is drawn),
  never a store flag.
- `viewPlaceStore`: where the user is inside a surface (the version being read, the
  suggestion chosen), reported by the surface while it is open, for the view's address.
- `secretsStore`: which API keys main holds and what is known about them. A key never
  reaches it. Screens read `useSecretsStatus` and change keys through its actions.

Getting somewhere that takes more than one store (another template's history, a dialog on
a template that isn't open, clearing what covers the app) goes through
`features/navigation/showPlace.ts`. A layer opening or closing on its own talks to
`overlayStore` directly.

Stored data goes features → stores → the storage service → main. Stores hold state and
actions, and export their reads (`useVersion`, `readVersion`, …). Only stores use the
service, and only `storage` and `useStored` from `lib/services/storageService.ts`: where a
read comes from (cache or main) and what a write makes stale are the service's concern,
along with `getDb()` (ESLint refuses the rest, `DbError` aside). A component that reads
as it renders sits inside a `ReadBoundary`.

## Calling main

Only service files touch `window.mosaic` (`platform` aside, which is a fact, not a call):
`lib/services/`, and `features/dev-tools/devService.ts` for the tools' own. This is a
convention, not a lint rule. A service is named for what it does and reads `window.mosaic`
when called, never at import. State several screens share goes through a store
(`secretsStore`); a call only one screen makes may use a service directly.

- A read with a sensible answer when it fails goes through `readOr`: it logs, answers, and
  never rejects, so the screen has no catch to write.
- An action the user started rejects, and the screen says so, usually with `attempt`. Wording
  and toasts never live in a service.
- An answer main expects to give (a refused key check, a refused start) stays a result, not
  a failure.

## UI foundation

- Screens import shared primitives from `@/components/ui-kit`, grouping named imports into
  one declaration. `components/ui-kit.ts` explicitly re-exports the `App*` wrappers, `Text`,
  `Badge`, `Chip`, `Note`, `ReadingColumn`, and `DialogFrame` parts, plus `textVariantClasses`
  and the `TextVariant` type for typography on elements that cannot use `Text`. It adds no behavior.
  No other barrels or `index.ts` files.
- `components/kit/` holds all `App*.tsx` implementations, `Badge`, `Chip`, `DialogFrame`,
  `Note`, `ReadingColumn`, and `Text`, plus private helpers `controlStyles.ts`, `textVariants.ts`,
  `HintLayer.tsx`, and `hintRegistry.ts`. Folder membership is not the public API: helpers and
  tooltip internals are not exported by `ui-kit.ts`; only `textVariantClasses` and `TextVariant`
  are exposed from the typography helper. Implementations and internals use direct file imports,
  never back through `ui-kit.ts`. Their unit tests live in `components/kit/__tests__/`;
  `components/__tests__/ui-kit.test.ts` stays with the public entry point.
- Higher-level components `ConfirmDeleteDialog`, `HeaderLinkControls`, `ReadBoundary`,
  `MosaicMark`, and the hook `useNoSelectionBehindLayers` stay at the `components/` root,
  use direct imports, and are not exported by `ui-kit.ts`. Raw shadcn parts remain in
  `components/ui/`, separate from the app's implementations in `components/kit/`.
- Use Radix/shadcn primitives (new-york, zinc base), not hand-rolled equivalents, through
  their `App*` wrappers in `components/kit/`: `AppButton`, `AppMenu`, `AppSelect`, `AppInput`,
  `AppTextarea`, `AppDialog` (with `DialogFrame` for the framed dialogs), `AppToggleGroup`,
  `AppTabs`, `AppRadioGroup`, `AppCheckbox`, `AppSwitch`, `AppPopover`, `AppCollapsible`,
  `AppTooltip`, `AppCommand` (a search field over a list, on shadcn's command). Each draws
  the design's control (`components/kit/controlStyles.ts` holds the shared field, floating surface and list
  row) and passes Radix props through. ESLint refuses
  `components/ui/` anywhere else: a primitive with no wrapper gets one first.
- A wrapper builds on the shadcn part when its markup fits, and on Radix directly when the
  design's anatomy differs (a switch's knob, a radio's check, a segmented strip, tabs,
  the dialog's scrim). Variants only where the design has them (`size="sm"`), never a
  restyle at the call site.
- Use the appropriate primitive for tabs, toggles, and other non-button semantics.
- Conditional notices use `Note isShown={…}`, kept mounted so its exit can finish. The
  note owns opt-in fade presence and retains its content on its own root; don't add a
  motion wrapper at the call site. Omit `isShown` for a static note.
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
- Colours come from the theme tokens in `index.css`, defined for both themes: never a
  literal (`oklch(…)`, `#…`) or a Tailwind palette shade (`zinc-500`, `amber-600`) in app UI.
  When one is missing, add a token. The resume page (black on white in both themes) is
  the exception. ESLint refuses these, raw type sizes and weights, and stock shadows
  (`STYLE_RULES` in `eslint.config.js`).
- No opacity utilities for hierarchy in app-owned components (`text-*/..`, `bg-*/..`,
  `border-*/..`, `ring-*/..`, `opacity-*`). Use explicit tone steps or semantic tokens:
  stronger titles/actions get higher contrast, metadata/secondary copy lower.
- React Compiler handles eligible memoization. Write pure components and follow the Rules
  of React; don't add manual memoization by default or remove existing memoization blindly.
  Compiler optimization does not replace effect dependencies or Zustand subscriptions.

## Type

- The interface is set in Source Sans 3 and Source Code Pro (`public/fonts/`, SIL OFL, loaded
  from disk). The resume page keeps Arial and `HEADLESS_LAYOUT`; nothing below reaches it.
- Ten roles from the design (`Type - Scale and Font`): heading, editor, title, body, strong,
  secondary, meta, eyebrow, tag, key. Each is a `text-*` token in `index.css` carrying size,
  line height, tracking and weight (`secondary`'s is `text-support`, since `text-secondary`
  is a colour). Weights: `font-regular` 460, `font-control` 560, `font-strong` 650,
  `font-tag` 700. `caption` is meta's size in sans, for a small label that isn't a number.
- Tracking and line height come with the role. A look that needs its own (a chip, a badge)
  is written once in `components/kit/` (`Badge`, `AppButton size="chip"`); ESLint refuses
  `tracking-[…]` and `leading-[…]` elsewhere.
- Write interface text as `<Text variant="…">` (from `@/components/ui-kit`, implemented in
  `components/kit/Text.tsx`); its table in `components/kit/textVariants.ts` adds the
  role's family, case and colour. No bare `<h1>`–`<h6>`, `<p>` or `<span>` styled with type
  classes: keep the element for its meaning with `as` (`<Text as="h3" variant="title">`),
  since headings are how screen readers and the e2e specs find things. Where an element can't be a `Text`, such as a Radix part,
  use `textVariantClasses(variant)` from `@/components/ui-kit` (which also exports the
  `TextVariant` type). Override colour through `className`, never the size.
- Text colour is `foreground`, `ink-soft`, `ink-muted` or `ink-faint`; status colours only
  for meaning. Tabular numbers on counts, times, labels and percentages (the meta role has
  them).
- `cn` knows the role names (`lib/utils.ts`; the `cn` package is aliased to it), so a colour
  passed beside a role keeps the role. Add a new role in both places.

## Tours

`features/onboarding/` holds every tour, a folder each (`getting-started/`), with what they
share at its root. Tours point at live elements marked with `tourTargetProps(...)` from
`tourTargets.ts`: the app's landmarks, named for the element and marked once, which every
tour's steps pick from. Features import the markers; onboarding imports no feature.
Moving, renaming, or removing a marked element changes the tours: keep each step's copy
true and run `e2e/app/tour.spec.ts`. e2e launches store the tour as seen and the history tips
off; a spec that wants them passes `withApp({ showTour: true })` or
`withApp({ showHistoryTips: true })`.

## Keyboard shortcuts

- Every shortcut is an action in `lib/shortcutCatalog.ts`, with its default keys and the
  rules for rebinding (fixed keys, refused keys, conflicts). A person's own keys are user
  data: `shortcutBindings` in `uiStore`, kept by Reset interface, never in bundles.
- Read keys through `stores/shortcutBindings.ts`: `matchesAction(event, id)` in
  handlers, `useShortcutLabel(id)` in tooltips and hints. Never match or print a default
  combination directly, or a rebound key stops working or shows the old keys.
- A new shortcut is a catalog entry, a label and a group in `features/shortcuts/shortcutList.ts`.

## Responsive layout

- Use relative units (%, vw, rem, fr), `clamp()`, `min()`, `max()`, and container queries.
  Pixels are allowed only as floors/ceilings inside those, e.g. `max(200px, 22vw)`.
- Desktop only, minimum window width 720px. Narrow means a small desktop window, not a
  phone layout: editor and preview stay side by side. Before committing UI changes,
  check for overflow or collapsed layouts across window sizes.
- **Resume pages are the exception:** `@/features/preview/PreviewPage` and its contents
  use exact point dimensions as pixels. Scale the container with `transform: scale()`;
  never CSS `zoom` or relative page dimensions, which can change line wraps versus PDF.

## Motion

- For local animation, check `lib/motion/` first and extend it from actual needs rather
  than duplicating lifecycle code or adding an animation dependency. Before changing
  the library or using its APIs, read `src/lib/motion/CLAUDE.md` (renderer-relative).
- Whole-view changes and moves between boxes use `features/view-transitions/`; read
  `src/features/view-transitions/CLAUDE.md` before changing or using that layer. View
  transitions block input, so keep frequent or interruptible changes local.
- Simple CSS transitions and Radix-owned presence stay with their appropriate primitives.
  Respect reduced motion, clean up on unmount, and handle rapid changes safely.
