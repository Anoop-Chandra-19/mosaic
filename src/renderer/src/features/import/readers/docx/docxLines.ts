import {
  paragraphsOf,
  whereIs,
  type DocxBlock,
  type DocxCell,
  type DocxDocument,
  type DocxNote,
  type DocxParagraph,
  type DocxTable,
} from './docxModel';
import type { LinkColor, LinkStyle } from '@shared/types/resume';
import {
  BULLET_MARKER,
  DATE_LIKE,
  decideLinkColor,
  decideLinkStyle,
  isCapitals,
  PAGE_NUMBER,
  titleCase,
  type ImportLine,
} from '../../parsing/importLines';
import {
  isHeadingLength,
  matchSectionHeader,
  SHORT_LINE_LENGTH,
} from '../../parsing/sectionHeaders';

/** A bullet typed by hand in a symbol font, whose glyphs Word keeps in the Private Use Area. */
const SYMBOL_BULLET = /^\s*[-]\s*/;

/** What pushes text to the right of a line: a run of tabs, or of three or more spaces. */
const BREAK = /\t+| {3,}/g;

/** Space above a paragraph that reads as a blank line: 12 points, in twips. */
const GAP_SPACING = 240;
/** One line of the document, before anything is decided about what it means. */
interface Piece {
  line: ImportLine;
  paragraph: DocxParagraph;
  /** How the line is set, to compare with other lines: style, weight, slant, size. */
  look: string;
  /** It labels a row of a table whose other cell holds that row's content. */
  label: boolean;
  /** The first line of its part, which a page header or a name starts with. */
  first: boolean;
}

/** A paragraph on its way to becoming lines, with what the table around it said. */
interface Flat {
  paragraph: DocxParagraph;
  /** Text from the cell beside it, when a table set it out to the right. */
  aside?: string;
  label?: boolean;
  /** A row of a table begins here. */
  gap?: boolean;
}

export interface DocxReading {
  lines: ImportLine[];
  notes: DocxNote[];
  /** Text read but deliberately not made into lines, so the review step can still show it. */
  leftOut: string[];
  /** How the document draws its links; undefined when it has none to go by. */
  linkStyle?: LinkStyle;
  /** The ink its links print in; undefined when it has none. */
  linkColor?: LinkColor;
}

const cellIsEmpty = (cell: DocxCell) =>
  cell.continued || !paragraphsOf(cell.blocks).some((p) => p.text.trim());

const cellText = (cell: DocxCell) =>
  paragraphsOf(cell.blocks)
    .map((p) => p.text.trim())
    .filter(Boolean)
    .join(' ');

const cellLines = (cell: DocxCell) => paragraphsOf(cell.blocks).filter((p) => p.text.trim()).length;

type Reading = 'aside' | 'label' | 'columns';

/**
 * What a two-column table is doing — a title with its dates to the right, a label with its
 * content, or two columns — which a row on its own rarely says, so the whole table votes.
 * A section name Mosaic knows outweighs how long the two sides are; length decides only
 * where no name does, and where nothing decides, columns keep every cell whole.
 */
function readingOf(table: DocxTable): Reading {
  const votes: Record<Reading, number> = { aside: 0, label: 0, columns: 0 };
  let pairs = 0;
  for (const row of table.rows) {
    const filled = row.cells.filter((cell) => !cellIsEmpty(cell));
    // A row spanning the width — a heading row — says nothing about the columns.
    if (filled.length !== 2) continue;
    pairs++;
    const [left, right] = filled;
    const leftText = cellText(left);
    const rightText = cellText(right);
    const leftIsSection = matchSectionHeader(leftText) !== null;
    const rightIsSection = matchSectionHeader(rightText) !== null;
    // Sections down both sides: two stacks of sections, whatever the rest of the rows say.
    if (leftIsSection && rightIsSection) return 'columns';
    const rightIsShort = cellLines(right) === 1 && rightText.length <= SHORT_LINE_LENGTH;
    const leftIsShort = cellLines(left) === 1 && leftText.length <= SHORT_LINE_LENGTH;
    if (leftIsSection) votes.label++;
    else if (rightIsShort && (DATE_LIKE.test(rightText) || rightText.length < leftText.length)) {
      votes.aside++;
    } else if (leftIsShort && leftText.length < rightText.length) votes.label++;
    else votes.columns++;
  }
  if (pairs === 0) return 'columns';
  const [best, count] = Object.entries(votes).sort((a, b) => b[1] - a[1])[0] as [Reading, number];
  // A tie decides nothing, so the table is read as columns rather than guessed at.
  return Object.values(votes).filter((vote) => vote === count).length > 1 ? 'columns' : best;
}

/**
 * A table read as columns: down the first column, then down the next, the way such a page
 * reads. A cell spanning the whole width breaks the columns apart — it belongs to neither —
 * so those tables are read row by row instead, and the note says which was done.
 */
function columnsOf(table: DocxTable, notes: DocxNote[]): Flat[] {
  const filled = (cell: DocxCell) => !cellIsEmpty(cell);
  const width = table.rows.reduce((widest, row) => Math.max(widest, row.columns), 0);
  const spanning = table.rows.some((row) =>
    row.cells.some((cell) => filled(cell) && cell.span >= width && width > 1)
  );
  const wide = table.rows.some((row) => row.cells.filter(filled).length > 1);

  const read = (cells: DocxCell[]) =>
    cells.flatMap((cell) => {
      const flats = flatten(cell.blocks, notes);
      if (flats.length) flats[0].gap = true;
      return flats;
    });

  if (spanning || width <= 1) {
    if (wide) {
      notes.push({
        kind: 'uncertain',
        message:
          'A table lays out part of this file in columns, and a row of it spans them all. Mosaic read it row by row — check the order.',
        where: whereIs(table.source),
      });
    }
    return table.rows.flatMap((row) => read(row.cells));
  }

  if (wide) {
    notes.push({
      kind: 'uncertain',
      message:
        'A table lays out part of this file in columns. Mosaic read the first column, then the next — check the order.',
      where: whereIs(table.source),
    });
  }
  // Each cell belongs to the column it starts in, so a merged cell is read once. Only
  // columns a cell starts in are visited: what a file says of its width is not trusted.
  const columns = new Map<number, DocxCell[]>();
  for (const row of table.rows) {
    for (const cell of row.cells) {
      const column = columns.get(cell.column);
      if (column) column.push(cell);
      else columns.set(cell.column, [cell]);
    }
  }
  return [...columns].sort(([a], [b]) => a - b).flatMap(([, cells]) => read(cells));
}

/** A table row's cells read as a line and the text set beside it. */
function pairedRow(cells: DocxCell[], reading: 'aside' | 'label', notes: DocxNote[]): Flat[] {
  const [left, right] = cells;
  const flats = flatten(left.blocks, notes);
  const first = flats.find((flat) => flat.paragraph.text.trim());
  if (!first) return flatten(right.blocks, notes);
  if (reading === 'aside') {
    first.aside = cellText(right);
    return flats;
  }
  first.label = true;
  return [...flats, ...flatten(right.blocks, notes)];
}

/** Blocks as paragraphs in reading order, with what each table's shape adds to them. */
function flatten(blocks: DocxBlock[], notes: DocxNote[]): Flat[] {
  const flats: Flat[] = [];
  for (const block of blocks) {
    if (block.kind === 'paragraph') {
      flats.push({ paragraph: block });
      continue;
    }
    const reading = readingOf(block);
    if (reading === 'columns') {
      flats.push(...columnsOf(block, notes));
      continue;
    }
    for (const row of block.rows) {
      const filled = row.cells.filter((cell) => !cellIsEmpty(cell));
      const rowFlats =
        filled.length === 2
          ? pairedRow(filled, reading, notes)
          : filled.flatMap((cell) => flatten(cell.blocks, notes));
      if (rowFlats.length) rowFlats[0].gap = true;
      flats.push(...rowFlats);
    }
  }
  return flats;
}

/**
 * A line's text and the aside set on its right. Text after a right-aligned tab stop is an
 * aside; so is short text pushed right by several tabs or a run of spaces (on a line that
 * isn't centred), and short text
 * after a single tab when it reads as a date — which is how a file written without tab
 * stops still gives up its dates. Not in a list item, where only a tab stop says so.
 */
function splitAside(raw: string, paragraph: DocxParagraph, listed: boolean): ImportLine {
  const text = raw.trim();
  const last = [...text.matchAll(BREAK)].at(-1);
  const centred = paragraph.align === 'center';
  // A centred line keeps its runs of spaces; elsewhere they were pushing text along.
  const flat = { text: centred ? text.replace(/\t+/g, ' ') : text.replace(BREAK, ' ') };
  if (!last) return flat;
  const aside = text.slice(last.index + last[0].length).trim();
  const short = aside.length <= SHORT_LINE_LENGTH;
  const byTabStop = last[0].startsWith('\t') && paragraph.rightTab;
  // Spaces can't push anything to the edge of a centred line: there they only space it out,
  // as between a header's items.
  const pushed = !listed && !centred && last[0] !== '\t' && short;
  const dated = !listed && last[0] === '\t' && short && DATE_LIKE.test(aside);
  if (!byTabStop && !pushed && !dated) return flat;
  const before = text
    .slice(0, last.index)
    .split(BREAK)
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' — ');
  return { text: before, aside };
}

/** Each paragraph as lines: a list item is one, other paragraphs one per line break. */
function toPieces(flats: Flat[]): Piece[] {
  const pieces: Piece[] = [];
  let gap = false;
  const parts = new Set<string>();
  for (const flat of flats) {
    const { paragraph } = flat;
    const first = !parts.has(paragraph.source.path);
    if (!paragraph.text.trim()) {
      gap = pieces.length > 0;
      continue;
    }
    parts.add(paragraph.source.path);
    if (flat.gap || paragraph.spaceBefore >= GAP_SPACING) gap = gap || pieces.length > 0;

    const marker = BULLET_MARKER.exec(paragraph.text) ?? SYMBOL_BULLET.exec(paragraph.text);
    const text = marker ? paragraph.text.slice(marker[0].length) : paragraph.text;
    const listed = paragraph.list?.marker === true || marker !== null;
    const lines: ImportLine[] = [];
    if (flat.aside !== undefined) {
      lines.push({ text: text.replace(/[\t\n]+/g, ' ').trim(), aside: flat.aside });
    } else if (listed) {
      // A list item with a date on its right is an entry's line, not a bullet.
      const line = splitAside(text.replace(/\n/g, ' '), paragraph, true);
      lines.push(
        line.aside ? line : { text: text.replace(/\s*[\t\n]\s*/g, ' ').trim(), role: 'bullet' }
      );
    } else {
      for (const part of text.split('\n')) {
        if (part.trim()) lines.push(splitAside(part, paragraph, false));
      }
    }

    lines.forEach((line, index) => {
      if (gap) line.gapBefore = true;
      gap = false;
      // Mosaic sets a header line centred or from the left; right-aligned has no match here.
      if (paragraph.align === 'center') line.align = 'center';
      else if (paragraph.align !== 'right') line.align = 'left';
      line.origin = `${paragraph.source.path} ${paragraph.source.at}`;
      const { style, outline, bold, italic, caps, size } = paragraph;
      const capitals = caps || isCapitals(line.text);
      const label = flat.label === true && index === 0;
      const look = [style, outline, bold, italic, capitals, size, label].join('|');
      pieces.push({ line, paragraph, look, label, first: first && index === 0 });
    });
  }
  return pieces;
}

/** The size most of the text is set in. */
function bodySizeOf(pieces: Piece[]): number {
  const lengths = new Map<number, number>();
  for (const { paragraph, line } of pieces) {
    lengths.set(paragraph.size, (lengths.get(paragraph.size) ?? 0) + line.text.length);
  }
  return [...lengths].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
}

/**
 * The page header and footer. A header's lines are read as the document's own — many
 * resumes keep the name and contact details there — except where they repeat what the body
 * already says. A footer is page furniture: its text is left out, and shown as left out
 * unless it is only a page number.
 */
function pageFurniture(pieces: Piece[]): { lines: Piece[]; leftOut: string[] } {
  const body = new Set<string>();
  for (const piece of pieces) {
    if (piece.paragraph.source.part !== 'body') continue;
    body.add(piece.line.text.trim());
    if (piece.line.aside) body.add(piece.line.aside.trim());
  }
  // Text and aside apart, so a repeated name can't take a new address out with it.
  const newPartsOf = ({ line }: Piece) =>
    [line.text, line.aside ?? '']
      .map((part) => part.trim())
      .filter((part) => part && !PAGE_NUMBER.test(part) && !body.has(part));

  const leftOut: string[] = [];
  const lines: Piece[] = [];
  for (const piece of pieces) {
    const { part } = piece.paragraph.source;
    if (part === 'body') {
      lines.push(piece);
      continue;
    }
    const parts = newPartsOf(piece);
    if (parts.length === 0) continue;
    if (part === 'footer') {
      leftOut.push(parts.join(' '));
      continue;
    }
    piece.line.text = parts[0];
    if (parts.length > 1) piece.line.aside = parts[1];
    else delete piece.line.aside;
    lines.push(piece);
  }
  return { lines, leftOut };
}

/**
 * A Word file's blocks as lines. Word's own marks are evidence, not the answer: a resume
 * may set its name in Heading 1, its section headings in plain bold, and its entries as
 * list items. So a heading is a line whose words name a section Mosaic knows, or one set
 * the way those are; an entry's line has an aside, or bullets around it, or is set like
 * such a line. Where the evidence doesn't reach, the line stays a plain line: less
 * structure, not less content.
 */
export function docxLines(document: DocxDocument): DocxReading {
  const notes = [...document.notes];
  const all = toPieces(flatten(document.blocks, notes));
  const { lines: pieces, leftOut } = pageFurniture(all);
  const bodySize = bodySizeOf(pieces);
  const standsOut = ({ paragraph, line, label }: Piece) =>
    paragraph.bold ||
    paragraph.caps ||
    isCapitals(line.text) ||
    paragraph.outline !== undefined ||
    paragraph.size > bodySize ||
    label;

  const at = new Map(pieces.map((piece, index) => [piece, index]));

  // Headings. The line a part starts with is a name or a page header, not a section.
  const isKnown = ({ line }: Piece) =>
    line.role !== 'bullet' && !line.aside && matchSectionHeader(line.text) !== null;
  // A line with a date beside it, or bullets under it, is an entry's — however it is set.
  const titlesAnEntry = (piece: Piece) =>
    piece.line.aside !== undefined ||
    pieces[at.get(piece)! + 1]?.line.role === 'bullet' ||
    (piece.paragraph.list?.marker ?? false);
  const couldHead = (piece: Piece) =>
    !piece.first &&
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
  const outlines = pieces.flatMap((piece) =>
    couldHead(piece) && piece.paragraph.outline !== undefined ? [piece.paragraph.outline] : []
  );
  const sectionOutline =
    !pieces.some(isKnown) && outlines.length
      ? outlines.reduce((top, outline) => Math.min(top, outline))
      : undefined;
  const atSectionOutline = (piece: Piece) =>
    sectionOutline !== undefined && piece.paragraph.outline === sectionOutline;

  for (const piece of pieces) {
    const heading =
      isKnown(piece) || (couldHead(piece) && (headingLook(piece.look) || atSectionOutline(piece)));
    if (!heading) continue;
    piece.line.role = 'heading';
    if (isCapitals(piece.line.text)) piece.line.text = titleCase(piece.line.text);
  }

  // Entries, inside sections.
  const first = pieces.findIndex((piece) => piece.line.role === 'heading');
  if (first >= 0) {
    const candidates = pieces.slice(first + 1).filter((piece) => piece.line.role === undefined);
    const neighbours = (piece: Piece) => {
      const index = at.get(piece)!;
      return [pieces[index - 1]?.line.role, pieces[index + 1]?.line.role];
    };
    const entries = new Set(
      candidates.filter((piece) => piece.line.aside || neighbours(piece).includes('bullet'))
    );
    const entryLooks = new Set(
      [...entries].filter((piece) => standsOut(piece) || piece.paragraph.italic).map((p) => p.look)
    );
    for (const piece of candidates) if (entryLooks.has(piece.look)) entries.add(piece);

    pieces.forEach((piece, index) => {
      if (!entries.has(piece)) return;
      const previous = pieces[index - 1];
      const continues =
        entries.has(previous) && previous.look !== piece.look && !piece.line.gapBefore;
      if (!continues) piece.line.role = 'entry';
    });
  }

  const floating = pieces.filter((piece) => piece.paragraph.source.floating);
  if (floating.length) {
    notes.push({
      kind: 'uncertain',
      message: `${floating.length === 1 ? 'A text box holds' : 'Text boxes hold'} some of this file. Mosaic read ${floating.length === 1 ? 'it' : 'them'} where ${floating.length === 1 ? 'it is' : 'they are'} anchored — check the order.`,
      where: whereIs(floating[0].paragraph.source),
    });
  }
  // Judged over the links in what was kept: a page header's links are not the resume's.
  const links = [...new Set(pieces.map((piece) => piece.paragraph))].flatMap(
    (paragraph) => paragraph.links ?? []
  );
  const linkStyle = decideLinkStyle(links.map((link) => link.underlined));
  // A link with no colour of its own prints in Word's automatic ink: black, for this.
  const linkColor = decideLinkColor(links.map((link) => link.color ?? '#000000'));
  return {
    lines: pieces.map((piece) => piece.line),
    notes,
    leftOut,
    ...(linkStyle && { linkStyle }),
    ...(linkColor && { linkColor }),
  };
}
