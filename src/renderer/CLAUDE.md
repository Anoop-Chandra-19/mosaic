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

Stored data goes features → stores → the storage service → main. Stores hold state and
actions, and export their reads (`useVersion`, `readVersion`, …). Only stores use the
service, and only `storage` and `useStored` from `lib/storage/storageService.ts`: where a
read comes from (cache or main) and what a write makes stale are the service's concern,
along with `getDb()` (ESLint refuses the rest, `DbError` aside). A component that reads
as it renders sits inside a `ReadBoundary`.

## UI foundation

- Use Radix/shadcn primitives (new-york, zinc base), not hand-rolled equivalents, through
  their `App*` wrappers in `components/`: `AppButton`, `AppMenu`, `AppSelect`, `AppInput`,
  `AppTextarea`, `AppDialog` (with `DialogFrame` for the framed dialogs), `AppToggleGroup`,
  `AppTabs`, `AppRadioGroup`, `AppCheckbox`, `AppSwitch`, `AppPopover`, `AppCollapsible`,
  `AppTooltip`, `AppCommand` (a search field over a list, on shadcn's command). Each draws
  the design's control (`controlStyles.ts` holds the shared field, floating surface and list
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
  is written once in `components/` (`Badge`, `AppButton size="chip"`); ESLint refuses
  `tracking-[…]` and `leading-[…]` elsewhere.
- Write interface text as `<Text variant="…">` (`components/Text.tsx`); its table adds the
  role's family, case and colour. No bare `<h1>`–`<h6>`, `<p>` or `<span>` styled with type
  classes: keep the element for its meaning with `as` (`<Text as="h3" variant="title">`),
  since headings are how screen readers and the e2e specs find things. Where an element can't be a `Text`, such as a Radix part,
  use `textVariantClasses(variant)`. Override colour through `className`, never the size.
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
- Read keys through `features/shortcuts/shortcutBindings.ts`: `matchesAction(event, id)` in
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
