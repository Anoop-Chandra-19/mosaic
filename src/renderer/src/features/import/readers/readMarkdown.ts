import { splitEntryHeading, type EntryHeadingFields } from '@shared/resume/entryHeading';
import { markLink, type ImportLine } from '../parsing/importLines';
import { parseResumeLines, type ParsedResume } from '../parsing/parseResume';
import { matchSectionHeader } from '../parsing/sectionHeaders';

const ATX_HEADING = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?[ \t]*$/;
const SETEXT_H1_UNDERLINE = /^ {0,3}=+[ \t]*$/;
const THEMATIC_BREAK = /^ {0,3}(?:(?:-[ \t]*){3,}|(?:\*[ \t]*){3,}|(?:_[ \t]*){3,})$/;
const LIST_ITEM = /^ {0,3}(?:[-*+]|\d{1,9}[.)])(?:[ \t]+(.*))?$/;
/** A list item's next line, indented under it. */
const CONTINUATION = /^(?: {2,}|\t)\S/;

/** A backslash escape — any ASCII punctuation, as CommonMark allows. */
const ESCAPE = /\\([!-/:-@[-`{-~])/g;
/** Escaped characters sit in the Private Use Area while markup is read, so none is taken as markup. */
const PROTECTED = /[-]/g;

const protect = (text: string) =>
  text.replace(ESCAPE, (_, char: string) => String.fromCharCode(0xe000 + char.charCodeAt(0)));
const restore = (text: string) =>
  text.replace(PROTECTED, (char) => String.fromCharCode(char.charCodeAt(0) - 0xe000));

/** A line in italics and nothing else — how Mosaic writes an entry's dates. */
const ITALIC_LINE = /^(?:_(?!_)(.*[^_\s])_|\*(?!\*)(.*[^*\s])\*)$/;

/**
 * A line's words without its inline markup: emphasis and code marks go, a link is marked
 * with its words and its address (`markLink`). Takes and gives protected text.
 */
function unmark(text: string): string {
  return text
    .replace(
      /!?\[([^\]]*)\]\((?:<([^<>\n]*)>|([^)\s]+))[^)]*\)/g,
      (_, words: string, bracketed: string | undefined, bare: string | undefined) => {
        const url = bracketed ?? bare ?? '';
        return words ? markLink(words, url) : url;
      }
    )
    .replace(/<((?:https?:|mailto:)[^>\s]+|[^>\s]+@[^>\s]+)>/g, (_, url: string) =>
      markLink(url, url)
    )
    .replace(/(\*\*|__)(?=\S)(.+?)(?<=\S)\1/g, '$2')
    .replace(/(?<![\w*])\*(?=\S)(.+?)(?<=\S)\*(?![\w*])/g, '$1')
    .replace(/(?<![\p{L}\p{N}_])_(?=\S)(.+?)(?<=\S)_(?![\p{L}\p{N}_])/gu, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

const plain = (protectedText: string) => restore(unmark(protectedText));

/**
 * An entry heading's parts. A comma Mosaic's export escaped is protected, so only the
 * commas between parts split it.
 */
function entryFieldsOf(protectedText: string): EntryHeadingFields {
  const { title, organization, location } = splitEntryHeading(unmark(protectedText));
  return {
    title: restore(title),
    organization: restore(organization),
    location: restore(location),
  };
}

type Token =
  | { type: 'blank' }
  | { type: 'heading'; level: number; text: string }
  | { type: 'item'; text: string }
  | { type: 'text'; text: string; raw: string };

/** The document's blocks, a line at a time, with escapes protected. */
function tokenize(markdown: string): Token[] {
  const raws = markdown.replace(/\r\n?/g, '\n').split('\n');
  const tokens: Token[] = [];
  for (let i = 0; i < raws.length; i++) {
    const raw = protect(raws[i]);
    const heading = ATX_HEADING.exec(raw);
    const item = LIST_ITEM.exec(raw);
    const last = tokens.at(-1);
    if (raw.trim() === '' || THEMATIC_BREAK.test(raw)) {
      tokens.push({ type: 'blank' });
    } else if (heading) {
      // A closing run of # goes with the heading's marks.
      const text = (heading[2] ?? '').replace(/(?:^|[ \t]+)#+$/, '');
      tokens.push({ type: 'heading', level: heading[1].length, text });
    } else if (item) {
      tokens.push({ type: 'item', text: item[1] ?? '' });
    } else if (last?.type === 'item' && CONTINUATION.test(raw)) {
      last.text += ` ${raw.trim()}`;
    } else if (SETEXT_H1_UNDERLINE.test(raw) && last?.type === 'text') {
      tokens[tokens.length - 1] = { type: 'heading', level: 1, text: last.raw.trim() };
    } else {
      tokens.push({ type: 'text', text: raw.trim(), raw });
    }
  }
  return tokens;
}

/**
 * Markdown as lines. The name is the first heading when the document starts with one;
 * the next level of heading down starts sections, and anything deeper starts an entry —
 * its dates the line in italics under it. List items are bullets. This is the shape
 * Mosaic's own Markdown export writes, so that comes back exactly; other Markdown is read
 * the same way, as far as it follows it.
 */
export function markdownToLines(markdown: string): ImportLine[] {
  const tokens = tokenize(markdown);
  const first = tokens.find((token) => token.type !== 'blank');
  const nameHeading =
    first?.type === 'heading' && !matchSectionHeader(plain(first.text)) ? first : undefined;
  const levels = tokens.flatMap((token) =>
    token.type === 'heading' && token !== nameHeading ? [token.level] : []
  );
  const sectionLevel = Math.min(...levels);
  // With no headings to go by, a known section name on a line of its own is one.
  const namedHeadings = levels.length === 0;

  const lines: ImportLine[] = [];
  let gap = false;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.type === 'blank') {
      gap = lines.length > 0;
      continue;
    }
    let line: ImportLine;
    if (token === nameHeading) {
      line = { text: plain(token.text) };
    } else if (token.type === 'heading' && token.level <= sectionLevel) {
      line = { text: plain(token.text), role: 'heading' };
    } else if (token.type === 'heading') {
      line = { text: plain(token.text), role: 'entry', fields: entryFieldsOf(token.text) };
      // The dates: the heading itself in italics, or the line in italics under it.
      const own = ITALIC_LINE.exec(token.text);
      const next = tokens[i + 1];
      const under = next?.type === 'text' ? ITALIC_LINE.exec(next.text) : null;
      if (own) {
        line = { text: '', role: 'entry', aside: restore(own[1] ?? own[2]) };
      } else if (under) {
        line.aside = restore(under[1] ?? under[2]);
        i++;
      }
    } else if (token.type === 'item') {
      line = { text: plain(token.text), role: 'bullet' };
    } else {
      line = { text: plain(token.text) };
      if (namedHeadings && matchSectionHeader(line.text)) line.role = 'heading';
    }
    if (gap) line.gapBefore = true;
    gap = false;
    lines.push(line);
  }
  return lines;
}

/** A Markdown file as a resume to review. */
export function readMarkdown(markdown: string): ParsedResume {
  return parseResumeLines(markdownToLines(markdown));
}
