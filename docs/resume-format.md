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
- An entry has a title, organization, location, and dates, all free text. It prints as one
  italic line: `formatEntryHeading` joins the first three with ", " on the left, and the
  dates sit on the right (`src/shared/resume/entryHeading.ts`). Formats that carry only
  that line read it back with `splitEntryHeading`: first part the title, second the
  organization, the rest the location.
- What prints is chosen at three levels: a section's `hidden` (absent means on the
  resume), an entry's `selected`, and a bullet's `selected`. A hidden section keeps its
  entries' own choices, so putting it back restores exactly what was picked. Preview,
  every export, the word count, and the version diff all skip what is off; Mosaic JSON and
  bundles keep it, since they hold the whole document.
- `src/renderer/src/lib/resume/headlessLayout.ts` is the single source of page metrics:
  margins, font sizes, leading, indents. Preview and PDF read it; change numbers there,
  not in components.
- "Headless Headhunter" format: section headers are the only bold text below the name;
  job/project lines are italic; all text is black, but header links when the header asks
  for blue ones. Never add `letter-spacing` or
  `text-transform: uppercase` to section headers: both break ATS text extraction.
- Spacing follows the 18pt leading grid. Extra margins between bullets or entries push
  the page off-grid, compounding down the page.
- Preview pages use exact point dimensions as pixels, with `transform: scale()` on the
  container. Never CSS `zoom`: re-layout can change wrapping versus the exported PDF.

## Exports and round trips

- PDF embeds links on printed text, underlined only when the header requests it.
- DOCX (`features/export/docx/`) is written by Mosaic itself, no library: its own zip
  writer and the Word XML parts. It prints the PDF's page (the layout's numbers came from
  the format's Word template) through named styles: Title, Contact, Heading 1, Entry
  Heading (italic, dates after a right tab stop at the margin), List Bullet, and a
  Hyperlink character style carrying the header's link look. Links are real hyperlinks.
  Keep XML elements in the order the OOXML schema gives them: Word refuses a file that
  breaks it even where LibreOffice and Mosaic's reader don't.
- Header links can print blue (`linkColor: 'blue'`, Word's hyperlink blue); only the links
  change, everything else stays black. Preview, PDF, and DOCX honour it; Markdown and plain text
  can't carry it, and JSON Resume keeps it in `meta.mosaic.header`.
- Import reads the link look back where the file shows it: a PDF's underline is a thin
  line drawn just under a link's words (`readPdfRules`, judged in `pdfLines`), and its
  colour is the words' colour; a Word file's is run formatting, usually from its Hyperlink
  style. Most links underlined or blue sets the header so, and the review says so. A PDF's
  blue links with no underline come back black: text colour isn't read. Plain text and
  Markdown carry no styling.
- Markdown writes `[text](link)`; plain text writes `text (link)` unless text already is
  the address. JSON Resume fills standard fields and preserves the whole header in
  `meta.mosaic.header`.
- Entries: Markdown writes the entry's line as a `###` heading with a comma inside the
  title or organization escaped (`\,`), so its parts come back exactly — unless the title
  or organization is empty and a later part isn't, which moves the parts up a place; the
  dates go on the line under it in italics. JSON Resume puts each part in its field (position/name,
  institution, entity, issuer, ISO dates) and keeps what no field holds in
  `meta.mosaic.sections[].exact`. Plain text, PDF, and DOCX carry only the printed line:
  it reads back the same, but a comma inside a title or organization moves the parts.
- Every export format needs a round-trip test: export, import, compare what the page shows.
  Mosaic's own PDF, DOCX, Markdown, and JSON come back exactly within each format's
  supported representation; plain text explicitly states its losses.
- Document unsupported round-trip details in tests: alignment/underlining in Markdown
  and plain text. These exceptions must not become silent losses.
