# Resume format contracts

Read before changing resume schema, headers, sections, preview, import, or export.
These rules span shared logic and renderer features; paths are repository-relative.
See root `CLAUDE.md` for schema-version and data-safety rules.

## Header

- Under the name, `contact.header` is lines of items (`src/shared/resume/resumeHeader.ts`).
  Each line has a separator and alignment; each item has a kind, printable text, a link,
  and `shown`. Lines and items can be freely added, moved, and removed.
- Items print their own text and link, never by kind. Kind supplies meaning only: icon,
  placeholder, JSON Resume field, importer guess. `HEADER_PRESETS` defines built-ins;
  `custom` is user-written.
- `resolveHeaderItemHref` resolves typed links at print time: an address mails, a number
  calls, a dot or slash opens `https://`. Never rewrite the typed value.
- `shown: false` preserves the item and its data; empty text prints nothing but preserves
  the link. Every renderer/export uses `getPrintableHeaderLines`. Header prints only on
  the first page, matching the PDF.

## Sections and page layout

- Sections print by `layout` (`lines` or `entries`), never by `kind`. Kind is meaning only
  (icon, importer headings, JSON Resume). `src/shared/resume/sectionPresets.ts` defines
  built-ins, with any number of each; `custom` is a user-named section.
- `src/renderer/src/lib/resume/headlessLayout.ts` is the single source of page metrics:
  margins, font sizes, leading, indents. Preview and PDF read it; change numbers there,
  not in components.
- "Headless Headhunter" format: section headers are the only bold text below the name;
  job/project lines are italic; all text is black. Never add `letter-spacing` or
  `text-transform: uppercase` to section headers: both break ATS text extraction.
- Spacing follows the 18pt leading grid. Extra margins between bullets or entries push
  the page off-grid, compounding down the page.
- Preview pages use exact point dimensions as pixels, with `transform: scale()` on the
  container. Never CSS `zoom`: re-layout can change wrapping versus the exported PDF.

## Exports and round trips

- PDF embeds links on printed text, underlined only when the header requests it.
- Markdown writes `[text](link)`; plain text writes `text (link)` unless text already is
  the address. JSON Resume fills standard fields and preserves the whole header in
  `meta.mosaic.header`.
- Every export format needs a round-trip test: export, import, compare what the page shows.
  Mosaic's own PDF, Markdown, and JSON come back exactly within each format's supported
  representation; plain text explicitly states its losses. A DOCX export, when built,
  needs a round-trip test too.
- Document unsupported round-trip details in tests: alignment/underlining in Markdown
  and plain text, and underlining in PDF. These exceptions must not become silent losses.
