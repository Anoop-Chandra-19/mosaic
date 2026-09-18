# Word files the import tests read

Two files written by programs other than Mosaic, so the DOCX reader is tested against
markup it didn't invent. `readDocx.test.ts` and `importDocx.test.ts` read them as whole
files; every other DOCX test builds its file with `buildDocx.ts`, which shares the reader's
own idea of what a Word file looks like and so can't catch a wrong idea on its own.

Neither holds anyone's real details: both are about a fictional Ada Lovelace.

## `libreoffice-resume.docx`

Written by LibreOffice 25.8 (`soffice --convert-to docx`) from a small HTML resume, on
2026-09-15. The file is exactly as LibreOffice wrote it — its markup _and_ its zip — so it
also tests the zip reader against an archive Mosaic didn't pack. It holds heading styles,
a bulleted list, a table of qualifications and their dates, a hyperlink, and a tab before
a date with no tab stop set.

## `word-resume.docx`

`word/document.xml`, `word/styles.xml` and `word/numbering.xml` as Microsoft Word 2026
wrote them, with **every piece of text replaced by fictional text** and the one hyperlink
pointed somewhere fictional. The replacement kept each paragraph's runs, tabs and spacing
as Word wrote them, so the run splitting, the `w:rsid` attributes, the styles and the
numbering are Word's own. The zip around them was repacked, and the parts a reader doesn't
need (embedded fonts, theme, settings, document properties) were dropped.

It is a real resume's shape: the name in Heading 1, section headings in plain bold with no
style, entries in Heading 3 — some of them list items — dates after a right-aligned tab
stop, and one entry whose date is pushed right with a run of spaces.

## Which producers are tested

Word and LibreOffice only. **Google Docs, Pages and Apple's exporters are untested** — no
file from them was available to test against, and nothing here says Mosaic reads them.
