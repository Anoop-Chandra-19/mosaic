import { matchSectionHeader } from './sectionHeaders';

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
}

/** A leading list marker: a bullet glyph, a dash, or a number. */
export const BULLET_MARKER = /^\s*(?:[•·▪◦‣∙*+–—-]|\d+[.)])\s+/;

/**
 * Plain text as lines: blank lines become gaps, list markers make bullets, and a line
 * whose words are a known section name is a heading. Text has no styling, so a heading
 * Mosaic doesn't know by name reads as an ordinary line.
 */
export function textToLines(text: string): ImportLine[] {
  const lines: ImportLine[] = [];
  let gap = false;
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    if (raw.trim() === '') {
      gap = lines.length > 0;
      continue;
    }
    const line: ImportLine = { text: raw.trim() };
    if (BULLET_MARKER.test(raw)) {
      line.role = 'bullet';
      line.text = raw.replace(BULLET_MARKER, '').trim();
    } else if (matchSectionHeader(raw)) {
      line.role = 'heading';
    }
    if (gap) line.gapBefore = true;
    gap = false;
    lines.push(line);
  }
  return lines;
}
