import { stripMailtoOrTelScheme, isSameAddress } from '@/lib/resume/resumeHeader';
import { isHeadingLength, matchSectionHeader } from './sectionHeaders';

/**
 * One line of a resume being imported, whatever it came from. Readers turn their source
 * into these — a text file by its markers, a DOCX by its styles, a PDF by where text sits
 * and how it is set — and `parseResumeLines` builds the resume from them. A reader joins
 * wrapped lines itself: each ImportLine is one logical line.
 */
export interface ImportLine {
  /** The line's words; a link in them is marked with `markLink`. */
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
  /** Where the line sits across the page, for a reader that can tell. */
  align?: 'center' | 'left';
  /**
   * Where the line came from, for a reader that can say — "word/document.xml
   * body/tbl[1]/tr[2]/tc[1]/p[1]". Nothing on the page depends on it; it is for tracing a
   * line back to the file it was read from.
   */
  origin?: string;
}

/** A leading list marker: a bullet glyph, a dash, or a number. */
export const BULLET_MARKER = /^\s*(?:[•·▪◦‣∙*+–—-]|\d+[.)])\s+/;

/**
 * Words that date a piece of a resume. Only ever evidence towards a date beside a title —
 * short text on the right is often a place instead, and text with a year in it is often
 * neither.
 */
export const DATE_LIKE =
  /\b(?:1[5-9]|2[01])\d{2}\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\b|\b(?:present|current|ongoing|to date|now)\b/i;

/** A page number, alone or with its total: what a header or footer repeats on every page. */
export const PAGE_NUMBER = /^(page\s*)?\d+(\s*(of|\/)\s*\d+)?$/i;

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
 * A link's words and where it goes, as one line would show both: the address alone when
 * the words are that same address ("github.com/ada"); otherwise the words and then the
 * address, so neither a "LinkedIn" link nor a "linkedin.com" one loses the profile.
 */
export function linkText(words: string, url: string): string {
  const address = stripMailtoOrTelScheme(url);
  const [, lead, shown, trail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(words)!;
  if (!shown || isSameAddress(shown, url)) return `${lead}${address}${trail}`;
  return `${lead}${shown} ${address}${trail}`;
}

/*
 * A link inside a line's text, as a reader marks it: the words and the address between
 * Unicode noncharacters, which text never holds — unlike the private use area, where
 * symbol fonts keep their bullets. The words stay in the line — joined, trimmed, and
 * measured with it — until `parseResumeLines` decides what the link is for: an item in the
 * header, or "words address" anywhere else.
 */
const LINK_START = String.fromCharCode(0xfdd0);
const LINK_ADDRESS = String.fromCharCode(0xfdd1);
const LINK_END = String.fromCharCode(0xfdd2);
const LINK_MARK_RANGE = `${LINK_START}-${LINK_END}`;
const LINK_MARKS = new RegExp(`[${LINK_MARK_RANGE}]`, 'g');
const MARKED_LINK = new RegExp(
  `${LINK_START}([^${LINK_MARK_RANGE}]*)${LINK_ADDRESS}([^${LINK_MARK_RANGE}]*)${LINK_END}`,
  'g'
);

/** Words that link to `url`, marked in a line's text. Space around the words stays outside. */
export function markLink(words: string, url: string): string {
  const [, lead, shown, trail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(words.replace(LINK_MARKS, ''))!;
  if (!shown) return words;
  const address = url.replace(LINK_MARKS, '');
  return `${lead}${LINK_START}${shown}${LINK_ADDRESS}${address}${LINK_END}${trail}`;
}

/** A line's text with each marked link written out as `linkText` writes it. */
export const replaceMarkedLinksWithText = (text: string) =>
  text.replace(MARKED_LINK, (_, words: string, url: string) => linkText(words, url));

/** A line's text without link marks: the words as they show, addresses dropped. */
export const removeLinkMarks = (text: string) => text.replace(MARKED_LINK, '$1');

/** The first marked link's address in a piece of text, or ''. */
export const findMarkedLinkUrl = (text: string) =>
  new RegExp(MARKED_LINK.source).exec(text)?.[2] ?? '';

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
