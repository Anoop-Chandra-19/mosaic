# Typography

How Mosaic sets text: the interface's fonts and type roles, the controls that carry them, and
the printed resume, which keeps its own metrics. The design's source is the Claude Design
project's `Type - Scale and Font` specimen and the tokens at the top of `mosaic-app.css`.

## At a glance

Mosaic has **two typography systems**, and neither reaches into the other:

|                 | App interface                                       | Printed resume                           |
| --------------- | --------------------------------------------------- | ---------------------------------------- |
| Purpose         | Navigation, editing, settings, history, dialogs     | The document shown on paper and exported |
| Font            | Source Sans 3; Source Code Pro for meta and keys    | Arial-compatible sans                    |
| Sizes           | Ten roles, as `text-*` tokens in `index.css`        | Exact point metrics                      |
| Colour          | Ink tokens, the same names in both themes           | Black, with optional blue header links   |
| Source of truth | `index.css` tokens, `Text`, and the `App*` wrappers | `HEADLESS_LAYOUT` in `headlessLayout.ts` |
| Adaptation      | Layout, wrapping and spacing change; sizes never do | Fixed page layout, visually scaled       |

## 1. Fonts

- **Source Sans 3** (interface) and **Source Code Pro** (meta, keys), both SIL OFL 1.1, are
  Adobe's variable `.woff2` files in
  [`public/fonts/`](../src/renderer/public/fonts/), each with its `OFL.txt`. They are bundled
  and loaded from disk, never fetched.
- `@font-face` registers the upright files, weights 200 to 900, with `font-display: block`;
  `index.html` preloads both, so the first layout already has them and nothing shifts when
  they arrive. The italics are bundled for later and not registered.
- `--font-sans` and `--font-mono` in `@theme` name them, with system fallbacks.
- The body defaults to the body role: Source Sans 3 at 460, 13px on 20px, antialiased.
- The serif families in `public/fonts/` (Source Serif 4, EB Garamond, Lora) are registered
  but not used.

## 2. The ten roles

Each role is one `text-*` token carrying size, line height, tracking and weight. Pixel
values assume a 16px root; the tokens are in rem. The same in both themes and both densities.

| Role      | Token          | Size / line | Tracking | Weight | Family | Case  | Default colour |
| --------- | -------------- | ----------- | -------- | ------ | ------ | ----- | -------------- |
| heading   | `text-heading` | 17 / 24     | -0.015em | 650    | sans   |       | `foreground`   |
| editor    | `text-editor`  | 15 / 22     | -0.01em  | 650    | sans   |       | `foreground`   |
| title     | `text-title`   | 14 / 20     | -0.005em | 650    | sans   |       | `foreground`   |
| body      | `text-body`    | 13 / 20     | 0        | 460    | sans   |       | `ink-soft`     |
| strong    | `text-strong`  | 13 / 20     | 0        | 650    | sans   |       | `foreground`   |
| secondary | `text-support` | 12 / 18     | 0        | 460    | sans   |       | `ink-muted`    |
| meta      | `text-meta`    | 11 / 16     | 0        | 460    | mono   |       | `ink-faint`    |
| eyebrow   | `text-eyebrow` | 11 / 16     | 0.07em   | 650    | sans   | upper | `ink-faint`    |
| tag       | `text-tag`     | 10 / 14     | 0.04em   | 700    | sans   | upper | `ink-muted`    |
| key       | `text-key`     | 11 / 16     | 0        | 550    | mono   |       | `ink-soft`     |

`secondary` is a colour name already (`--color-secondary`), so its size token is
`text-support`; in code the role is still `variant="secondary"`.

`caption` is meta's size in sans (`text-meta`, 460, `ink-faint`): a small label or note
that isn't a number or a name, such as a shortcut hint, a group label in a list, or an
option's description.

**Weights** have their own tokens for controls and emphasis: `font-regular` 460,
`font-control` 560, `font-strong` 650, `font-tag` 700. A weight class beside a role class
wins, so `text-body font-control` is a control's label.

**Tabular numbers** come with the meta role; use `tabular-nums` wherever else digits line
up or tick (counts, times, zoom, page numbers).

## 3. Writing text

- [`<Text variant="…" as="…">`](../src/renderer/src/components/Text.tsx) renders a role:
  its table ([`textVariants.ts`](../src/renderer/src/components/textVariants.ts)) adds the
  family, case and default colour to the token. `as` picks the element, so a heading can
  be an `h3` without heading size.
- Where an element can't be a `Text`, such as a Radix part, use
  `textVariantClasses(variant)`.
- Override colour through `className`, never the size. Text colour is `foreground`,
  `ink-soft`, `ink-muted` or `ink-faint`; status colours (`add`, `del`, `info`, `amber`)
  only for meaning.
- `cn` knows the role, weight and shadow tokens
  ([`lib/utils.ts`](../src/renderer/src/lib/utils.ts)); the `cn` package is aliased to it in
  the build and tests, so shadcn's parts merge the same way. Without that it reads
  `text-meta` as a colour and drops it beside one. A new role goes in both places.

## 4. Controls

Feature code reaches every primitive through an `App*` wrapper in `components/`; ESLint
refuses `components/ui/` anywhere else. Each wrapper draws the design's control with the
roles built in:

| Wrapper                                     | Design             | Type                                                                             |
| ------------------------------------------- | ------------------ | -------------------------------------------------------------------------------- |
| `AppButton`                                 | `.btn`             | body at `font-control`; `xs` support, `2xs` meta; solid and accent `font-strong` |
| `AppButton size="chip"`                     | `.hchip`           | meta in sans at `font-strong`, `0.04em`: a value shown in place                  |
| `Badge`                                     | `.badge`, `.htag`  | `md` support, `sm` meta; sans, `font-strong`, `0.02em`                           |
| `AppInput`, `AppTextarea`                   | `.input`           | body, `foreground`, faint placeholder                                            |
| `AppSelect`                                 | `.input` + `.menu` | body; list rows as menu rows                                                     |
| `AppMenu`                                   | `.menu`            | rows body in `ink-soft`; labels support in `ink-faint`                           |
| `AppToggleGroup`                            | `.seg`             | support at `font-control`, `ink-muted`; chosen in `foreground`                   |
| `AppTabs`                                   | `.panetab`         | body at `font-control`                                                           |
| `AppDialog`, `DialogFrame`                  | `.modal`           | title role; description body in `ink-muted`                                      |
| `AppTooltip`                                | –                  | support in `foreground`                                                          |
| `AppPopover`                                | menu surface       | body                                                                             |
| `AppCheckbox`, `AppSwitch`, `AppRadioGroup` | `.chk`, `.switch`  | no text of their own                                                             |

Shared surfaces (the field, what floats over the window, a list row) are written once in
[`controlStyles.ts`](../src/renderer/src/components/controlStyles.ts). A caller's
`className` adjusts layout (width, margins); a size or colour the design doesn't have is a
new wrapper variant, not a class at the call site. Settings rows
([`SettingRow`](../src/renderer/src/features/settings/SettingRow.tsx)) are body at
`font-control` over support in `ink-muted`.

## 5. Where the interface is

Every screen is on the roles and the colour tokens. ESLint keeps it that way
(`STYLE_RULES` in `eslint.config.js`): renderer code may not use an arbitrary `text-[…]`
size, a Tailwind size or weight (`text-xs`, `font-semibold`), a palette shade
(`zinc-500`), white or black, a literal colour in an arbitrary value (`oklch(…)`, `#…`), or
a stock shadow (`shadow-md`). An arbitrary `tracking-[…]` or `leading-[…]` is allowed only
in `components/`, so a spacing the roles don't carry becomes a shared look (`Badge`, an
`AppButton` size) rather than a number repeated at each use. The resume page
(`features/preview/`, the page marks, `lib/resume/`) and `components/ui/` are exempt.

## 6. Wrapping, density, and window size

- Prose uses `text-pretty`; editable text may use `wrap-anywhere` or `wrap-break-word`.
  Filenames, version names and metadata often `truncate` or stay `whitespace-nowrap`.
- Compact density changes spacing (`--density-*`, `dense:`), never type: a role is the same
  size in both densities.
- The app targets desktop windows of at least 720px. Container queries adapt layout or hide
  secondary labels; there is no fluid type.
- A history pane too narrow for a legible page can show
  [`VersionAsText`](../src/renderer/src/features/history/full-history/VersionAsText.tsx):
  app-styled prose, **not the printed resume layout**.

## 7. Printed resume typography

[`HEADLESS_LAYOUT`](../src/renderer/src/lib/resume/headlessLayout.ts) owns the shared metrics
for the current "Headless Headhunter" format. See [resume-format.md](resume-format.md) for
the contract; this section is a typography summary, not a replacement for those rules.

| Resume role             | Size   | Leading         | Presentation                           |
| ----------------------- | ------ | --------------- | -------------------------------------- |
| Name                    | 14pt   | `1.15` / 16.1pt | Bold, centered                         |
| Contact/header line     | 12pt   | 16pt            | Normal; alignment configured per line  |
| Section title           | 10.5pt | 18pt            | Bold, original case, no added tracking |
| Entry heading and dates | 10.5pt | 18pt            | Italic, heading left and dates right   |
| Paragraphs and bullets  | 10.5pt | 18pt            | Normal                                 |

- **Preview font:** `Arial, "Liberation Sans", Helvetica, sans-serif`. The page's roots reset
  `font-normal tracking-normal`, so the interface's 460 body weight never reaches it.
- **PDF font:** built-in `Helvetica`, `Helvetica-Bold`, and `Helvetica-Oblique` in
  [`PdfResumeDocument`](../src/renderer/src/features/export/pdf/PdfResumeDocument.tsx).
- **Word font:** Arial, with named paragraph styles in
  [`createDocxExport`](../src/renderer/src/features/export/docx/createDocxExport.ts).
- **Colour:** black; header links can request blue and/or underlining. The page remains
  white in both app themes. History marks are a separate on-screen annotation layer
  (`paper-*` tokens).
- **Geometry:** point numbers render as CSS pixels at 1:1 inside the preview; the whole
  page scales with `transform: scale()`. A 10.5pt body size therefore starts as 10.5 CSS
  pixels in the unscaled preview, not the usual browser point-to-pixel conversion.
- **Wrapping:** preview measurement and PDF line breaking use the shared font stack.
  Kerning is disabled to match Word. Changing sizes, leading, tracking, or page widths
  can change wrapping and pagination, so app typography must not override these metrics.
- **Spacing:** body leading follows the 18pt grid; section starts reserve one blank body
  line except at the top of a page. Arbitrary extra text margins can break that grid.

`PreviewHeader` and `PreviewSection` apply these metrics directly. Section titles are the
only bold text below the name; entry headings are italic rather than bold. The interface's
uppercase, tracked eyebrow and tag roles are deliberately not used on printed section
titles. Page numbers below the preview sheet are app metadata, not resume body text.
