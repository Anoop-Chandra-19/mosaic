import type { NormalizedResumeExport } from '../normalizeResumeExport';

/**
 * Beyond Latin-1, what the PDF's built-in Helvetica can draw: Windows-1252's typographic
 * marks. Anything else comes out as another character or as nothing ("Łukasz" reads
 * "Aukasz").
 */
const WINDOWS_1252_EXTRAS = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ');

function canDraw(char: string): boolean {
  const code = char.codePointAt(0)!;
  return (
    code === 0x0a ||
    (code >= 0x20 && code <= 0x7e) ||
    (code >= 0xa0 && code <= 0xff) ||
    WINDOWS_1252_EXTRAS.has(char)
  );
}

/** The characters the PDF would print that its font can't draw, each once, in order. */
export function findCharactersPdfCannotDraw(data: NormalizedResumeExport): string[] {
  const printed = [
    data.contact.name,
    ...data.contact.lines.flatMap((line) => [line.separator, ...line.items.map((i) => i.text)]),
    ...data.sections.flatMap((section) => [
      section.label,
      ...section.entries.flatMap((entry) => [
        entry.heading,
        entry.dates,
        entry.text,
        ...entry.bullets,
      ]),
    ]),
  ];
  const missing = new Set<string>();
  for (const text of printed) {
    for (const char of text) if (!canDraw(char)) missing.add(char);
  }
  return [...missing];
}
