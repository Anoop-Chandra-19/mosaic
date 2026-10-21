/*
 * The fictional resumes the hand-run checks measure and the Heavy profile holds, as pasted
 * text: one entry of long bullets, or the worst case, every section full. The checks
 * (`scripts/large-resume.ts`) paste it into Import; Heavy reads it with the same importer.
 */

const bullet = (index: number) =>
  `- Wrote program ${index} for the analytical engine, checking every step of it by hand against the tables computed the long way, and wrote down whatever differed.`;

/** Pasted text with `bullets` bullets in one entry (130 make about seven A4 pages). */
export function largeResumeText(bullets: number): string {
  const text = ['Ada Lovelace', 'ada@example.com', '', 'Experience', 'Analyst, Engine Works'];
  return [...text, ...Array.from({ length: bullets }, (_, i) => bullet(i))].join('\n');
}

/** Headings import knows, so each is a section of its own. */
const WORST_CASE_SECTIONS = [
  'Experience',
  'Internships',
  'Projects',
  'Volunteering',
  'Awards',
  'Publications',
];
const ENTRIES_PER_SECTION = 5;
const BULLETS_PER_ENTRY = 7;
export const WORST_CASE_BULLETS =
  WORST_CASE_SECTIONS.length * ENTRIES_PER_SECTION * BULLETS_PER_ENTRY;

/**
 * Every section full of entries full of long bullets: past the ten pages the preview draws,
 * so the editor holds all of it and the preview as much as it ever lays out.
 */
export function worstCaseResumeText(): string {
  const lines = ['Ada Lovelace', 'ada@example.com · +1 555 0100 · Engine Works', ''];
  let index = 0;
  for (const section of WORST_CASE_SECTIONS) {
    lines.push(section);
    for (let entry = 1; entry <= ENTRIES_PER_SECTION; entry++) {
      lines.push(`${section} lead ${entry}, Engine Works ${entry}`);
      for (let b = 0; b < BULLETS_PER_ENTRY; b++) lines.push(bullet(index++));
    }
    lines.push('');
  }
  return lines.join('\n');
}
