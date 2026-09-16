import { isHeadingLength, matchSectionHeader } from './sectionHeaders';

/**
 * One line of a resume being imported, whatever it came from. Readers turn their source
 * into these — a text file by its markers, a DOCX by its styles, a PDF by where text sits
 * and how it is set — and `parseResumeLines` builds the resume from them. A reader joins
 * wrapped lines itself: each ImportLine is one logical line.
 */
export interface ImportLine {
  text: string;
  /**
   * How the source marks the line; a plain line when absent.
   * - `heading`: a section heading.
   * - `entry`: an entry's title line (`text` is the title; `aside` its subtitle).
   * - `bullet`: a list item, its marker already removed.
   */
  role?: 'heading' | 'entry' | 'bullet';
  /** Text set apart on the right of the same line — an entry's subtitle. */
  aside?: string;
  /** Visible space before the line: a blank line, paragraph spacing, a gap on the page. */
  gapBefore?: boolean;
  /**
   * Where the line came from, for a reader that can say — "word/document.xml
   * body/tbl[1]/tr[2]/tc[1]/p[1]". Nothing on the page depends on it; it is for tracing a
   * line back to the file it was read from.
   */
  origin?: string;
}

/** A leading list marker: a bullet glyph, a dash, or a number. */
export const BULLET_MARKER = /^\s*(?:[•·▪◦‣∙*+–—-]|\d+[.)])\s+/;

export const isCapitals = (text: string) => /\p{Lu}/u.test(text) && !/\p{Ll}/u.test(text);

/** Words a title keeps in lower case, unless one starts it. */
const MINOR_WORDS = new Set('a an and as at by for from in of on or the to with'.split(' '));

/** "WORK HISTORY" → "Work History". An acronym comes back as a word ("Ai Research"). */
export function titleCase(text: string): string {
  return text
    .toLowerCase()
    .split(' ')
    .map((word, index) =>
      index > 0 && MINOR_WORDS.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(' ');
}

/**
 * Plain text as lines: blank lines become gaps, list markers make bullets, and a line
 * whose words are a known section name is a heading. Text has no styling, so the one
 * other sign of a heading is capitals: in a resume that writes the headings it names in
 * capitals — as Mosaic's own text export does — a short line in capitals after a blank
 * line is a heading too, and comes back in title case.
 */
export function textToLines(text: string): ImportLine[] {
  const raws = text.replace(/\r\n?/g, '\n').split('\n');
  const known = raws.filter((raw) => !BULLET_MARKER.test(raw) && matchSectionHeader(raw));
  const capitalHeadings = known.length > 0 && known.every(isCapitals);

  const lines: ImportLine[] = [];
  let gap = false;
  for (const raw of raws) {
    if (raw.trim() === '') {
      gap = lines.length > 0;
      continue;
    }
    const line: ImportLine = { text: raw.trim() };
    const capitalHeading =
      capitalHeadings && gap && isCapitals(line.text) && isHeadingLength(line.text);
    if (BULLET_MARKER.test(raw)) {
      line.role = 'bullet';
      line.text = raw.replace(BULLET_MARKER, '').trim();
    } else if (matchSectionHeader(raw) || capitalHeading) {
      line.role = 'heading';
      if (isCapitals(line.text)) line.text = titleCase(line.text);
    }
    if (gap) line.gapBefore = true;
    gap = false;
    lines.push(line);
  }
  return lines;
}
