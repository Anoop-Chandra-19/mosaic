import type { LinkColor, LinkStyle } from '@shared/types/resume';
import {
  BULLET_MARKER,
  DATE_LIKE,
  decideLinkColor,
  decideLinkStyle,
  isCapitals,
  markLink,
  PAGE_NUMBER,
  removeLinkMarks,
  sourceOf,
  titleCase,
  type ImportLine,
  type LeftOutLine,
  type SourceLine,
} from '../../parsing/importLines';
import {
  isHeadingLength,
  matchSectionHeader,
  SHORT_LINE_LENGTH,
} from '../../parsing/sectionHeaders';
import type { PdfDocument, PdfLink, PdfNote, PdfPage, PdfRule, PdfRun } from './pdfModel';

/*
 * Distances are in ems — multiples of the size of the text they measure — so a resume set
 * in 9 points reads the same way as one set in 12.
 */

/** Runs whose baselines are this close sit on one line. */
const SAME_BASELINE = 0.3;
/** A gap wider than this between two runs is a space between words. */
const WORD_GAP = 0.1;
/** A gap this wide within a line sets what follows apart: a date on the right, or a column. */
const APART_GAP = 2;
/** A gap this wide, a tab's, sets apart short text that ends a line at the margin or dates it. */
const TAB_GAP = 0.75;
/** Lines that start or end this close together are aligned. */
const ALIGNED = 0.5;
/** Space beyond a column's usual distance between lines that reads as a blank line. */
const GAP_SPACE = 0.5;
/** The narrowest space between two columns. */
const GUTTER = 1;
/** Set in at least this far past the lines around it, a line is indented. */
const INDENT = 1;
/** A space's width, near enough for any common typeface. */
const SPACE_WIDTH = 0.28;
/** What a guessed word width may be out by. */
const WIDTH_SLACK = 0.25;
/** The fewest lines that make a column. */
const COLUMN_LINES = 3;
/** How far down a page columns may begin, below a header that spans them, in lines. */
const HEADER_LINES = 12;
/** The widest gaps on a page tried as a gutter between columns. */
const GUTTER_TRIES = 3;
/** A line this close to the top or bottom of its page may be a running header or footer. */
const EDGE_LINES = 2;

/** A bullet drawn from a symbol font, whose glyphs sit in the Private Use Area. */
const SYMBOL_BULLET = new RegExp('^\\s*[\\uE000-\\uF8FF]\\s*');
/** A marker alone, however far it sits from its text. */
const LONE_MARKER = new RegExp('^\\s*(?:[•·▪◦‣∙●■*+–—-]|[\\uE000-\\uF8FF])\\s*$');
const SOFT_HYPHEN = new RegExp('\\u00AD', 'g');
const NO_BREAK_SPACE = new RegExp('\\u00A0', 'g');
const LIGATURE = new RegExp('[\\uFB00-\\uFB06]', 'g');

const clean = (text: string) =>
  text
    .replace(SOFT_HYPHEN, '')
    .replace(NO_BREAK_SPACE, ' ')
    .replace(LIGATURE, (ligature) => ligature.normalize('NFKC'));

/** Runs on a line, set apart from the rest of it by a wide gap. */
interface Segment {
  runs: PdfRun[];
  left: number;
  right: number;
}

/** The runs on one baseline of a page, in segments. */
interface Row {
  y: number;
  size: number;
  segments: Segment[];
}

/** A line of the document, with what is needed to decide what it is. */
interface Piece {
  line: ImportLine;
  page: number;
  /** The part of its page it was read from: 0 for the whole width, 1 and 2 for columns. */
  column: number;
  y: number;
  /** Where its text starts, after any marker. */
  left: number;
  /** Where its text ends, before any aside. */
  right: number;
  /** Where lines in its part of the page may reach: the right margin, or a column's edge. */
  margin: number;
  size: number;
  bold: boolean;
  italic: boolean;
  /** Face, weight, slant, and size: what a wrapped line keeps from the line it continues. */
  style: string;
  /** Its style and whether it is in capitals, to compare with other lines. */
  look: string;
  /** The guessed width of its first word, to tell whether it could have fit on the line above. */
  firstWord: number;
  /** A bullet's marker with no text beside it. */
  markerOnly?: boolean;
}

export interface PdfReading {
  lines: ImportLine[];
  notes: PdfNote[];
  /** Text read but deliberately not made into lines, so the review step can still show it. */
  leftOut: LeftOutLine[];
  /** How the file draws its links; undefined when it has none to go by. */
  linkStyle?: LinkStyle;
  /**
   * The ink its links print in, told by their underlines' colour: text colour isn't read,
   * so links without underlines leave it undefined.
   */
  linkColor?: LinkColor;
}

/**
 * A link's underline: a rule drawn just under its words' baseline, across most of them,
 * and not much wider — a rule between sections runs on past the words. Null when there is
 * none; undefined when no words sit in the link's area to judge by.
 */
function findLinkUnderline(link: PdfLink, page: PdfPage): PdfRule | null | undefined {
  const words = page.runs.filter((run) => {
    if (!run.upright || !run.text.trim()) return false;
    const middle = run.y - run.size * 0.35;
    return (
      middle >= link.top &&
      middle <= link.bottom &&
      run.x < link.right &&
      run.x + run.width > link.left
    );
  });
  if (words.length === 0) return undefined;
  const left = Math.max(link.left, Math.min(...words.map((run) => run.x)));
  const right = Math.min(link.right, Math.max(...words.map((run) => run.x + run.width)));
  const baseline = Math.max(...words.map((run) => run.y));
  const size = Math.max(...words.map((run) => run.size));
  const span = right - left;
  if (span <= 0) return undefined;
  const underline = page.rules.find((rule) => {
    const middle = (rule.top + rule.bottom) / 2;
    const covered = Math.min(rule.right, right) - Math.max(rule.left, left);
    return (
      middle >= baseline - size * 0.15 &&
      middle <= baseline + size * 0.45 &&
      covered >= span * 0.6 &&
      rule.right - rule.left <= span + size * 2
    );
  });
  return underline ?? null;
}

/** How the document draws its links, judged over every link that has words in it. */
function linkLookOf(document: PdfDocument): Pick<PdfReading, 'linkStyle' | 'linkColor'> {
  const underlines = document.pages.flatMap((page) =>
    page.links
      .map((link) => findLinkUnderline(link, page))
      .filter((underline) => underline !== undefined)
  );
  const linkStyle = decideLinkStyle(underlines.map((underline) => underline !== null));
  const linkColor = decideLinkColor(underlines.map((underline) => underline?.color));
  return { ...(linkStyle && { linkStyle }), ...(linkColor && { linkColor }) };
}

const largest = (values: number[]) => values.reduce((top, value) => Math.max(top, value), 0);

const stackOf = (piece: Piece) => `${piece.page}:${piece.column}`;

/** Whether most of these runs' characters have a quality. */
function mostly(runs: PdfRun[], quality: (run: PdfRun) => boolean): boolean {
  let total = 0;
  let having = 0;
  for (const run of runs) {
    const length = run.text.trim().length;
    total += length;
    if (quality(run)) having += length;
  }
  return total > 0 && having * 2 > total;
}

/** A font's name without the six-letter tag a PDF adds to a font it carries a subset of. */
const faceOf = (font: string) => font.replace(/^[A-Z]{6}\+/, '');

/** A page's upright text as rows, top to bottom, each cut where a wide gap sets text apart. */
function rowsOf(page: PdfPage): Row[] {
  const runs = page.runs
    .filter((run) => run.upright && run.text.trim())
    .sort((a, b) => a.y - b.y || a.x - b.x);
  const blanks = page.runs.filter((run) => run.upright && run.text !== '' && !run.text.trim());
  const grouped: { runs: PdfRun[]; size: number }[] = [];
  for (const run of runs) {
    const row = grouped.at(-1);
    const size = Math.max(row?.size ?? 0, run.size);
    if (row && Math.abs(run.y - row.runs[0].y) <= SAME_BASELINE * size) {
      row.runs.push(run);
      row.size = size;
    } else {
      grouped.push({ runs: [run], size: run.size });
    }
  }
  // The margins are taken to match, since the text on a page may never reach its right one.
  const pageRight = page.width - runs.reduce((low, run) => Math.min(low, run.x), Infinity);

  return grouped.map(({ runs: onRow, size }) => {
    onRow.sort((a, b) => a.x - b.x);
    const kept: PdfRun[] = [];
    for (const run of onRow) {
      // Some files draw text twice, a hair apart, to make it look heavier.
      const previous = kept.at(-1);
      if (previous?.text === run.text && Math.abs(previous.x - run.x) < WORD_GAP * size) continue;
      kept.push(run);
    }
    // Characters from each run to the end of the row, to find short text that ends it.
    const toEnd = new Array<number>(kept.length + 1).fill(0);
    for (let i = kept.length - 1; i >= 0; i--) toEnd[i] = toEnd[i + 1] + kept[i].text.trim().length;
    const rowRight = largest(kept.map((run) => run.x + run.width));
    // Short text after a tab's worth of space, ending the line at the margin or dating it.
    const endsApart = (from: number) => {
      if (toEnd[from] > SHORT_LINE_LENGTH) return false;
      const rest = kept
        .slice(from)
        .map((run) => run.text.trim())
        .join(' ');
      return pageRight - rowRight <= ALIGNED * size || DATE_LIKE.test(rest);
    };

    const segments: Segment[] = [];
    for (const [index, run] of kept.entries()) {
      const last = segments.at(-1);
      const gap = last ? run.x - last.right : 0;
      const tabbed = gap > TAB_GAP * size && endsApart(index);
      if (last && gap <= APART_GAP * size && !tabbed) {
        last.runs.push(run);
        last.right = Math.max(last.right, run.x + run.width);
      } else {
        segments.push({ runs: [run], left: run.x, right: run.x + run.width });
      }
    }
    // Spaces drawn as a run of their own, between words of a segment: how wide a gap
    // was meant to be ("github.com/ada    Portfolio"), which the gap alone can't say.
    // Only after words — never after a bullet's marker, where it would move the line's start.
    for (const segment of segments) {
      const isAfterWords = (blank: PdfRun) =>
        segment.runs.some(
          (run) => !LONE_MARKER.test(run.text) && run.x + run.width <= blank.x + WORD_GAP * size
        );
      const inside = blanks.filter(
        (blank) =>
          Math.abs(blank.y - onRow[0].y) <= SAME_BASELINE * size &&
          blank.x + blank.width < segment.right &&
          isAfterWords(blank)
      );
      if (inside.length) segment.runs = [...segment.runs, ...inside].sort((a, b) => a.x - b.x);
    }
    return { y: onRow[0].y, size, segments };
  });
}

/** The left and right edges of the text on a page, or in one of its columns. */
interface Frame {
  left: number;
  right: number;
}

/** Where columns start on a page, and the gutter between them. */
interface Columns {
  from: number;
  gutter: number;
}

/**
 * Two columns: from some row down, a band of the page no text crosses, with lines on the
 * left and lines on the right that share a left margin of their own. Short text ending at
 * the right margin beside a line on the left is that line's date, not part of a column.
 */
function columnsOf(rows: Row[]): Columns | undefined {
  const tries = Math.min(HEADER_LINES, rows.length - 2 * COLUMN_LINES);
  for (let from = 0; from <= tries; from++) {
    const region = rows.slice(from);
    const size = largest(region.map((row) => row.size));
    const spans = region.flatMap((row) => row.segments).sort((a, b) => a.left - b.left);
    const gaps: { gutter: number; width: number }[] = [];
    let reach = spans[0].right;
    for (const { left, right } of spans) {
      if (left - reach >= GUTTER * size)
        gaps.push({ gutter: (reach + left) / 2, width: left - reach });
      reach = Math.max(reach, right);
    }
    gaps.sort((a, b) => b.width - a.width);
    for (const { gutter } of gaps.slice(0, GUTTER_TRIES)) {
      const margin = rightMarginOf(region, gutter);
      if (margin === undefined) continue;
      // Lines above both columns that line up with neither, such as a contact line, head
      // the page rather than start the right-hand column.
      let start = from;
      const heads = (row: Row) =>
        !row.segments.some((s) => s.right < gutter) &&
        Math.abs(row.segments[0].left - margin) > ALIGNED * row.size;
      while (start < rows.length && heads(rows[start])) start++;
      // The gutter again, midway between the columns themselves.
      const below = rows.slice(start).flatMap((row) => row.segments);
      const leftEdge = largest(below.filter((s) => s.right < gutter).map((s) => s.right));
      const rightEdge = below
        .filter((s) => s.left > gutter)
        .reduce((low, s) => Math.min(low, s.left), Infinity);
      return { from: start, gutter: (leftEdge + rightEdge) / 2 };
    }
  }
  return undefined;
}

/** Where the right-hand column's lines start, when there is one beside the gutter. */
function rightMarginOf(region: Row[], gutter: number): number | undefined {
  const leftRows = region.filter((row) => row.segments.some((s) => s.right < gutter));
  if (leftRows.length < COLUMN_LINES) return undefined;
  const margin = largest(region.flatMap((row) => row.segments.map((s) => s.right)));
  const starts: number[] = [];
  for (const row of region) {
    const [first] = row.segments.filter((s) => s.left > gutter);
    if (!first) continue;
    const length = first.runs.reduce((sum, run) => sum + run.text.trim().length, 0);
    const beside = row.segments.some((s) => s.right < gutter);
    const aside =
      beside && length <= SHORT_LINE_LENGTH && margin - first.right <= ALIGNED * row.size;
    if (!aside) starts.push(first.left);
  }
  const size = largest(region.map((row) => row.size));
  const near = (start: number) =>
    starts.filter((other) => Math.abs(other - start) <= ALIGNED * size).length;
  const shared = starts.filter((start) => near(start) >= COLUMN_LINES);
  if (shared.length < COLUMN_LINES || shared.length * 2 < starts.length) return undefined;
  return shared.reduce((best, start) => (near(start) > near(best) ? start : best));
}

/** The part of a row on one side of a gutter. */
function sideOf(row: Row, gutter: number, side: 1 | 2): Row | undefined {
  const segments = row.segments.filter((s) => (side === 1 ? s.right < gutter : s.left > gutter));
  return segments.length ? { ...row, segments } : undefined;
}

/**
 * How far into a run each UTF-16 unit of its text starts, in points, with one more for its
 * end: by the font's glyph widths, or spread evenly when the font doesn't give them.
 */
function computeCharacterOffsets({ text, width, shares }: PdfRun): number[] {
  const offsets = [0];
  for (let i = 0; i < text.length; i++) {
    offsets.push(offsets[i] + (shares ? shares[i] * width : width / text.length));
  }
  return offsets;
}

/**
 * A segment's text. Words inside a link take its address with them, as the words and then
 * the address, so "LinkedIn" linked to a profile keeps the profile.
 */
function textOf(segment: Segment, row: Row, links: PdfLink[]): string {
  // Each word with the space before it, as the file spells it out, or one for a gap.
  const words: { text: string; space: string; url?: string }[] = [];
  // Inside the letters, clear of the line below: where a link's area must reach.
  const height = row.y - SAME_BASELINE * row.size;
  let end: number | undefined;
  // A run of only spaces, drawn on its own: as many spaces as its width holds.
  let spaces = '';
  for (const run of segment.runs) {
    const apart = end !== undefined && run.x - end > WORD_GAP * row.size;
    end = run.x + run.width;
    if (!run.text.trim()) {
      spaces += ' '.repeat(Math.max(1, Math.round(run.width / (SPACE_WIDTH * row.size))));
      continue;
    }
    const before = spaces || (apart ? ' ' : '');
    spaces = '';
    const at = computeCharacterOffsets(run);
    // Matched on the text as drawn, so offsets line up; cleaned word by word.
    for (const match of run.text.matchAll(/(\s*)(\S+)/g)) {
      const start = match.index + match[1].length;
      const middle = run.x + (at[start] + at[start + match[2].length]) / 2;
      const link = links.find(
        (l) => middle >= l.left && middle <= l.right && height >= l.top && height <= l.bottom
      );
      const space = clean(match[1]) || (match.index === 0 ? before : '');
      words.push({ text: clean(match[2]), space: words.length > 0 ? space : '', url: link?.url });
    }
  }

  let text = '';
  for (let i = 0; i < words.length; ) {
    const { url } = words[i];
    let j = i + 1;
    while (url && j < words.length && words[j].url === url) j++;
    const group = words
      .slice(i, j)
      .map((word, k) => (k > 0 ? word.space : '') + word.text)
      .join('');
    text += words[i].space + (url ? markLink(group, url) : group);
    i = j;
  }
  return text;
}

/** How wide the first word after `from` characters is, from its share of the run. */
function firstWordOf(run: PdfRun, from = 0): number {
  const [space, word] = /^(\s*)(\S*)/.exec(run.text.slice(from))!.slice(1);
  const at = computeCharacterOffsets(run);
  return at[from + space.length + word.length] - at[from];
}

/**
 * A row as lines. A marker makes a bullet — unless text is set apart on its right, which
 * makes it an entry's line with an aside. A known section's name with its content beside it
 * is the heading, then the content.
 */
function piecesOfRow(
  row: Row,
  frame: Frame,
  page: number,
  column: number,
  links: PdfLink[]
): Piece[] {
  let segments = row.segments;
  let marked = false;
  // A marker drawn on its own, near its text or far from it.
  const [head, ...rest] = segments[0].runs;
  if (LONE_MARKER.test(head.text) && (rest.length > 0 || segments.length > 1)) {
    marked = true;
    segments = rest.length
      ? [{ ...segments[0], runs: rest, left: rest[0].x }, ...segments.slice(1)]
      : segments.slice(1);
  }
  const texts = segments.map((segment) => textOf(segment, row, links).trim());
  let shift = 0;
  let skip = 0;
  const inline = marked ? null : (BULLET_MARKER.exec(texts[0]) ?? SYMBOL_BULLET.exec(texts[0]));
  if (inline) {
    marked = true;
    texts[0] = texts[0].slice(inline[0].length);
    const run = segments[0].runs[0];
    skip = inline[0].length;
    shift = run.text.length ? (run.width * skip) / run.text.length : 0;
  }

  const make = (text: string, parts: Segment[], aside?: string): Piece => {
    // A line of only an aside is set the way its aside is.
    if (parts.length === 0) parts = segments;
    const runs = parts.flatMap((s) => s.runs);
    const bold = mostly(runs, (run) => run.bold);
    const italic = mostly(runs, (run) => run.italic);
    const faces = new Map<string, number>();
    for (const run of runs) {
      faces.set(faceOf(run.font), (faces.get(faceOf(run.font)) ?? 0) + run.text.length);
    }
    const face = [...faces].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
    const size = Math.round(largest(runs.map((run) => run.size)) * 2) / 2;
    const style = [face, bold, italic, size].join('|');
    const starts = parts[0] === segments[0];
    const left = parts[0].left + (starts ? shift : 0);
    const right = parts.at(-1)!.right;
    // Centred: its middle at the middle between the margins, and not starting at the left
    // one. Left: from the left margin, stopping short of the right. A line that fills the
    // width says neither.
    const isAtLeftMargin = left - frame.left <= INDENT * size;
    const isAtRightMargin = frame.right - right <= INDENT * size;
    const isCentered =
      !isAtLeftMargin &&
      Math.abs((left + right) / 2 - (frame.left + frame.right) / 2) <= ALIGNED * size;
    const line: ImportLine = { text };
    if (isCentered) line.align = 'center';
    else if (isAtLeftMargin && !isAtRightMargin) line.align = 'left';
    if (aside !== undefined) line.aside = aside;
    else if (marked && starts) line.role = 'bullet';
    return {
      line,
      page,
      column,
      y: row.y,
      left,
      right,
      margin: frame.right,
      size,
      bold,
      italic,
      style,
      look: `${style}|${isCapitals(text)}`,
      firstWord: firstWordOf(parts[0].runs[0], starts ? skip : 0),
    };
  };

  if (segments.length === 1 && segments[0].runs.length === 1 && LONE_MARKER.test(texts[0])) {
    return [{ ...make('', segments), markerOnly: true }];
  }
  if (segments.length === 1) {
    // Short text alone on the right, ending at the margin: an aside with nothing beside it.
    const [only] = segments;
    const pastMiddle = only.left - frame.left > (frame.right - frame.left) / 2;
    const atMargin = frame.right - only.right <= ALIGNED * row.size;
    if (!marked && pastMiddle && atMargin && texts[0].length <= SHORT_LINE_LENGTH) {
      return [make('', [], texts[0])];
    }
    return [make(texts[0], segments)];
  }
  if (!marked && segments.length === 2 && matchSectionHeader(texts[0])) {
    return [make(texts[0], [segments[0]]), make(texts[1], [segments[1]])];
  }
  const last = texts.at(-1)!;
  if (last.length <= SHORT_LINE_LENGTH) {
    return [make(texts.slice(0, -1).join(' — '), segments.slice(0, -1), last)];
  }
  return [make(texts.join(' — '), segments)];
}

/** A page's lines in reading order: across the top, then down each column. */
function piecesOfPage(page: PdfPage, number: number, notes: PdfNote[]): Piece[] {
  const rows = rowsOf(page);
  const leftOf = (part: Row[]) =>
    part.reduce((low, row) => Math.min(low, row.segments[0].left), Infinity);
  // The margins are taken to match, since the text on a page may never reach its right one.
  const pageRight = page.width - leftOf(rows);
  const read = (part: Row[], column: number, reach: number) => {
    const right = largest(part.flatMap((row) => row.segments.map((s) => s.right)));
    const frame = { left: leftOf(part), right: Math.max(reach, right) };
    return part.flatMap((row) => piecesOfRow(row, frame, number, column, page.links));
  };
  const columns = rows.length >= 2 * COLUMN_LINES ? columnsOf(rows) : undefined;
  if (!columns) return read(rows, 0, pageRight);

  notes.push({
    kind: 'uncertain',
    message: `Page ${number} of this PDF is set in two columns. Mosaic read the left one, then the right, so check sections came out in order.`,
  });
  const band = read(rows.slice(0, columns.from), 0, pageRight);
  const sides = ([1, 2] as const).flatMap((side) =>
    read(
      rows.slice(columns.from).flatMap((row) => sideOf(row, columns.gutter, side) ?? []),
      side,
      side === 1 ? columns.gutter : pageRight
    )
  );
  return [...band, ...sides];
}

/**
 * Running headers and footers: text that recurs by the same edge of every page. A page
 * number goes wherever it is; other recurring text is kept where it first appears. Only
 * every page counts — two wrapped lines ending alike can meet at one height on two pages.
 */
function withoutFurniture(
  pieces: Piece[],
  pageCount: number
): { kept: Piece[]; leftOut: LeftOutLine[] } {
  const byPage = new Map<number, Piece[]>();
  for (const piece of pieces) {
    const onPage = byPage.get(piece.page);
    if (onPage) onPage.push(piece);
    else byPage.set(piece.page, [piece]);
  }
  const nearEdge = new Set<Piece>();
  for (const onPage of byPage.values()) {
    const sorted = [...onPage].sort((a, b) => a.y - b.y);
    for (const piece of [...sorted.slice(0, EDGE_LINES), ...sorted.slice(-EDGE_LINES)]) {
      nearEdge.add(piece);
    }
  }
  const key = (piece: Piece) => `${piece.line.text}|${piece.line.aside ?? ''}`.replace(/\d+/g, '#');
  const seen = new Set<string>();
  const leftOut: LeftOutLine[] = [];
  const shown = ({ line }: Piece) =>
    removeLinkMarks(line.aside ? `${line.text}   ${line.aside}` : line.text).trim();
  const kept = pieces.filter((piece) => {
    if (!nearEdge.has(piece)) return true;
    const { text, aside } = piece.line;
    const alone = (text || aside || '').trim();
    // A year beside a title is not a page number, however alone it stands.
    if (PAGE_NUMBER.test(alone) && !/\d{4}/.test(alone) && !(text && aside)) {
      leftOut.push({ text: alone, reason: 'page-number', canPlace: false });
      return false;
    }
    if (pageCount < 2) return true;
    const pages = new Set(
      [...nearEdge]
        .filter(
          (other) =>
            key(other) === key(piece) && Math.abs(other.y - piece.y) <= ALIGNED * piece.size
        )
        .map((other) => other.page)
    );
    if (pages.size < pageCount) return true;
    if (!seen.has(key(piece))) {
      seen.add(key(piece));
      return true;
    }
    if (!leftOut.some((line) => line.reason === 'repeated' && line.text === shown(piece))) {
      leftOut.push({ text: shown(piece), reason: 'repeated', canPlace: false });
    }
    return false;
  });
  return { kept, leftOut };
}

/** The distance between lines most of each column keeps. */
function pitchesOf(pieces: Piece[]): Map<string, number> {
  const steps = new Map<string, Map<number, number>>();
  for (let i = 1; i < pieces.length; i++) {
    const [above, below] = [pieces[i - 1], pieces[i]];
    if (stackOf(above) !== stackOf(below) || below.y <= above.y) continue;
    const counts = steps.get(stackOf(below)) ?? new Map<number, number>();
    const step = Math.round((below.y - above.y) * 2) / 2;
    counts.set(step, (counts.get(step) ?? 0) + 1);
    steps.set(stackOf(below), counts);
  }
  return new Map(
    [...steps].map(([stack, counts]) => [stack, [...counts].sort((a, b) => b[1] - a[1])[0][0]])
  );
}

/**
 * A line continues the one above when it starts where that one's text starts, is set the
 * same way, sits at the column's usual distance below it (or tops the next page), and its
 * first word could not have fit at the end of the line above — which is when text wraps.
 */
function continues(above: Piece, below: Piece, pitch: number | undefined): boolean {
  if (below.line.role === 'bullet' || below.line.aside !== undefined) return false;
  if (above.line.aside !== undefined || above.style !== below.style) return false;
  if (Math.abs(above.left - below.left) > ALIGNED * below.size) return false;
  const nextPage = below.page === above.page + 1 && below.column === above.column;
  if (!nextPage) {
    if (stackOf(above) !== stackOf(below) || pitch === undefined) return false;
    if (below.y - above.y - pitch > GAP_SPACE * below.size) return false;
  }
  const wanted = above.right + SPACE_WIDTH * below.size + below.firstWord;
  return wanted > above.margin - WIDTH_SLACK * below.size;
}

const PAGE_BREAK_JOIN = 'Ran across the page break. Check the join.';
const INDENT_BULLETS =
  'This PDF draws its bullets as shapes, so Mosaic found them by their indent. Check the bullets.';

const addDoubt = (line: ImportLine, doubt: string) => {
  line.doubts = [...new Set([...(line.doubts ?? []), doubt])];
};

function joinSources(above: Piece, below: Piece): SourceLine[] {
  const between: SourceLine[] = below.page === above.page ? [] : [{ pageBreak: true }];
  return [...sourceOf(above.line), ...between, ...sourceOf(below.line)];
}

/** Wrapped lines joined back into the lines the author wrote, and the space between them. */
function joinWraps(pieces: Piece[]): Piece[] {
  const pitches = pitchesOf(pieces);

  const joined: Piece[] = [];
  for (const piece of pieces) {
    const above = joined.at(-1);
    // A marker left at the foot of a page, its text carried to the next: they are one bullet.
    if (above?.markerOnly) {
      const { gapBefore } = above.line;
      const between: SourceLine[] = piece.page === above.page ? [] : [{ pageBreak: true }];
      Object.assign(above, piece, { markerOnly: false });
      if (piece.line.aside === undefined) above.line.role = 'bullet';
      if (gapBefore) above.line.gapBefore = true;
      above.line.source = [...between, ...sourceOf(above.line)];
      continue;
    }
    const pitch = pitches.get(stackOf(piece));
    if (above && continues(above, piece, pitch)) {
      // A hyphen at the end of a line is kept, and nothing put after it: "self-" "taught".
      const hyphenated = /\p{L}-$/u.test(above.line.text);
      above.line.source = joinSources(above, piece);
      if (piece.page !== above.page) addDoubt(above.line, PAGE_BREAK_JOIN);
      above.line.text += (hyphenated ? '' : ' ') + piece.line.text;
      Object.assign(above, { right: piece.right, y: piece.y, page: piece.page });
      continue;
    }
    if (above && stackOf(above) === stackOf(piece)) {
      if (pitch !== undefined && piece.y - above.y - pitch > GAP_SPACE * piece.size) {
        piece.line.gapBefore = true;
      }
    } else if (above?.page === piece.page) {
      piece.line.gapBefore = true;
    }
    joined.push(piece);
  }
  return joined;
}

/** "E X P E R I E N C E" as the word it spells, words apart by more than one space. */
function unspaced(text: string): string {
  const words = text.trim().split(/\s{2,}/);
  const spaced = words.every((word) => /^\p{L}(?: \p{L})+$/u.test(word));
  return spaced ? words.map((word) => word.replace(/ /g, '')).join(' ') : text;
}

/** The size most of the text is set in. */
function bodySizeOf(pieces: Piece[]): number {
  const lengths = new Map<number, number>();
  for (const { size, line } of pieces) {
    lengths.set(size, (lengths.get(size) ?? 0) + line.text.length);
  }
  return [...lengths].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
}

/**
 * Headings, entries, and bullets drawn as shapes. As for a Word file, how a line is set is
 * evidence, not the answer: a heading is a line naming a section Mosaic knows, or one set
 * the way those are; an entry's line has an aside, or bullets beside it, or is set like
 * such a line. True when it found bullets by their indent alone.
 */
function markRoles(pieces: Piece[]): boolean {
  for (const piece of pieces) {
    const text = unspaced(piece.line.text);
    if (text !== piece.line.text && matchSectionHeader(text)) {
      piece.line.source = sourceOf(piece.line);
      piece.line.text = text;
    }
  }
  const bodySize = bodySizeOf(pieces);
  const standsOut = (piece: Piece) =>
    piece.bold || isCapitals(piece.line.text) || piece.size > bodySize;
  const at = new Map(pieces.map((piece, index) => [piece, index]));

  const isKnown = ({ line }: Piece) =>
    line.role !== 'bullet' && line.aside === undefined && matchSectionHeader(line.text) !== null;
  const titlesAnEntry = (piece: Piece) =>
    piece.line.aside !== undefined || pieces[at.get(piece)! + 1]?.line.role === 'bullet';
  // The first line is a name, not a section.
  const couldHead = (piece: Piece) =>
    at.get(piece) !== 0 &&
    piece.line.role !== 'bullet' &&
    !titlesAnEntry(piece) &&
    isHeadingLength(piece.line.text) &&
    standsOut(piece);
  const tally = new Map<string, { known: number; other: number }>();
  for (const piece of pieces) {
    if (!couldHead(piece)) continue;
    const count = tally.get(piece.look) ?? { known: 0, other: 0 };
    count[isKnown(piece) ? 'known' : 'other']++;
    tally.set(piece.look, count);
  }
  // Set the way the known headings are, and not outnumbered by lines that are something else.
  const headingLook = (look: string) => {
    const count = tally.get(look);
    return count !== undefined && count.known > 0 && count.known >= count.other;
  };
  for (const piece of pieces) {
    if (!isKnown(piece) && !(couldHead(piece) && headingLook(piece.look))) continue;
    piece.line.role = 'heading';
    if (isCapitals(piece.line.text)) {
      piece.line.source = sourceOf(piece.line);
      piece.line.text = titleCase(piece.line.text);
    }
  }

  const first = pieces.findIndex((piece) => piece.line.role === 'heading');
  if (first < 0) return false;
  const body = pieces.slice(first + 1);

  // Bullets drawn as shapes leave no marker, only an indent under the line they belong to.
  let foundByIndent = false;
  if (!pieces.some((piece) => piece.line.role === 'bullet')) {
    const margins = new Map<string, number>();
    for (const piece of body) {
      margins.set(stackOf(piece), Math.min(margins.get(stackOf(piece)) ?? Infinity, piece.left));
    }
    body.forEach((piece, index) => {
      const above = body[index - 1];
      const indented = piece.left - margins.get(stackOf(piece))! >= INDENT * piece.size;
      if (!above || above.line.role === 'heading' || !indented) return;
      if (piece.line.role === undefined && piece.line.aside === undefined) {
        piece.line.role = 'bullet';
        foundByIndent = true;
      }
    });
  }

  const candidates = body.filter((piece) => piece.line.role === undefined);
  const neighbours = (piece: Piece) => {
    const index = at.get(piece)!;
    return [pieces[index - 1]?.line.role, pieces[index + 1]?.line.role];
  };
  const entries = new Set(
    candidates.filter(
      (piece) => piece.line.aside !== undefined || neighbours(piece).includes('bullet')
    )
  );
  const entryLooks = new Set(
    [...entries].filter((piece) => standsOut(piece) || piece.italic).map((piece) => piece.look)
  );
  for (const piece of candidates) if (entryLooks.has(piece.look)) entries.add(piece);
  pieces.forEach((piece, index) => {
    if (!entries.has(piece)) return;
    const previous = pieces[index - 1];
    const follows =
      entries.has(previous) &&
      previous.look !== piece.look &&
      !piece.line.gapBefore &&
      piece.line.aside === undefined;
    if (!follows) piece.line.role = 'entry';
  });
  return foundByIndent;
}

/**
 * A PDF's text as lines. Nothing in a PDF says what a line is — only where text sits and
 * how it is set — so these rules read positions and looks, and words only for the section
 * names Mosaic knows. Where the evidence doesn't reach, a line stays a plain line: less
 * structure, not less content.
 */
export function pdfLines(document: PdfDocument): PdfReading {
  const notes = [...document.notes];
  const leftOut: LeftOutLine[] = [];

  const sideways = document.pages.flatMap((page) =>
    page.runs.filter((run) => !run.upright && run.text.trim()).map((run) => clean(run.text).trim())
  );
  if (sideways.length) {
    notes.push({
      kind: 'excluded',
      message: 'Some text in this PDF runs sideways. Mosaic left it out.',
    });
    leftOut.push({ text: sideways.join(' '), reason: 'sideways', canPlace: true });
  }

  const pieces = document.pages.flatMap((page, index) => piecesOfPage(page, index + 1, notes));
  const furniture = withoutFurniture(pieces, document.pages.length);
  leftOut.push(...furniture.leftOut);
  const kept = joinWraps(furniture.kept);
  if (markRoles(kept)) {
    notes.push({ kind: 'uncertain', message: INDENT_BULLETS });
  }
  return {
    lines: kept.map((piece) => piece.line),
    notes,
    leftOut,
    ...linkLookOf(document),
  };
}
