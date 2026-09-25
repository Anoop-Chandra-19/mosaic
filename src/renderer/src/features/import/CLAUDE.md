# Resume import

Read with the root and renderer `CLAUDE.md` files, plus `docs/resume-format.md`
(repo-relative) for header semantics and export/import round-trip requirements.

- Layout: `readers/` turns file bytes into lines (or a parsed resume, for JSON Resume);
  `parsing/` turns lines into a resume; the dialog and `buildImportedResume` (new, replace,
  merge) stay at the top. `__tests__/resumeFixtures.ts` holds the round-trip fixtures
  shared across folders.
- `files.open('import')` returns bytes. `readImportFile` selects by extension: PDF, Word
  (.docx), Markdown, plain text, JSON Resume, or Mosaic JSON (sent to Restore). Unreadable
  inputs (scans, passwords, older .doc) get actionable messages in the dialog.
- Readers produce `ImportLine`s (`parsing/importLines.ts`); `parseResumeLines` builds the resume.
  JSON Resume's fields already carry meaning, so it bypasses lines.
- Readers mark links with `markLink` (Unicode noncharacters not present in documents).
  `parseResumeLines` interprets them: header items with text/link in the contact block;
  "words address" elsewhere.
- Nothing is written before review, and nothing is silently dropped: unplaced text goes
  into `leftOut` with a reason (page numbers and running heads too), and file-wide doubts
  into `warnings`. A reader that joins or changes a line keeps the file's own lines in
  `ImportLine.source` and puts doubts about it in `doubts`; `parseResumeLines` carries both
  to `ParsedResume.review` by section and item id, for the review's Source view.
- The review's keep/drop and "Add to" choices go through `applyImportChoices` before
  `buildImportedResume`, so every import mode writes the same resume.
- In `readers/pdf/` and `readers/docx/`, `readPdf` / `readDocx` report what a file holds; `pdfLines` /
  `docxLines` decide what it means. Keep semantic guesses out of readers.
- Files are untrusted. Our zip/XML readers validate strictly and stop at documented limits
  (`XML_LIMITS`, `PDF_LIMITS`, …). Readers must work in both the renderer and Node tests:
  no DOM or browser-only APIs.
- Use pdf.js's legacy build in both environments. In the app, bundle its worker with
  `?worker`: a URL worker under `file://` becomes a `blob:` script that CSP refuses.
- Tests build fictional files (`buildDocx`, `buildPdf`, react-pdf); never use a real
  person's resume. `readers/docx/__tests__/documents/` contains only fictional fixtures.
