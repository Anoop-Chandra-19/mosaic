# Page-break sweep

Whether the preview, the PDF, and the Word file end each page on the same line, measured
across a few hundred fictional resumes. Run by hand when pagination, an export, or the
layout numbers change; compare the tables before and after. Never in CI.

Needs a build (`bun run build`), LibreOffice (`soffice`) to lay out the Word files, and
`pdftotext` (poppler). LibreOffice stands in for Word; the rules in
`docs/resume-format.md` ("Page breaks") are what all three follow.

## Runs

```sh
# Opens each generated resume in the app, records the preview's pages, saves PDF and DOCX
SWEEP_SEED=1 SWEEP_COUNT=200 bunx playwright test -c scripts/page-break-sweep/playwright.config.ts

# Lays out the Word files, compares every page break, prints the table
node scripts/page-break-sweep/comparePageBreaks.ts 1
```

The same seed gives the same resumes, half on A4 and half on US Letter. Files land in
`scripts/page-break-sweep/results/seed-<n>/` (gitignored), with `summary.json` listing
every mismatch.

## Reading the table

Each page break is a count of the words before it, so two formats agree when they start
each page at the same word. A mismatch is labeled:

- **paragraph wrap**: both breaks fall inside one paragraph, so the two wrapped its lines
  differently;
- **rule**: they break at different lines otherwise: a different wrap earlier on the page,
  or a keep-together rule that differs;
- **page count**: one ran onto a page the other didn't.
