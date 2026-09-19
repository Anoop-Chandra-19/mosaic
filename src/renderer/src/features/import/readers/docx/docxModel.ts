/**
 * What a Word file holds, as read from it — not yet what any of it means. `readDocx`
 * fills this in: paragraphs with the evidence of how they are set, tables still shaped as
 * tables, and where each block came from. `docxLines` is what turns it into a resume, so
 * every guess about meaning is made there, in one place, with the whole document in view.
 */

/** Which part of a Word file a block came from. */
export type DocxPart = 'body' | 'header' | 'footer';

/** Where a block sits in the file: "word/document.xml", "body/tbl[1]/tr[2]/tc[1]/p[1]". */
export interface DocxSource {
  path: string;
  part: DocxPart;
  at: string;
  /** From a text box, which floats: where it sits on the page may not be where it is here. */
  floating?: boolean;
}

/** A paragraph's text and how it is set. Formatting is evidence, not meaning. */
export interface DocxParagraph {
  kind: 'paragraph';
  /** The text as written; a tab is "\t" and a line break "\n". */
  text: string;
  /** Its paragraph style's id. */
  style: string;
  /** The outline level its style gives it — 0 for Heading 1 — when it has one. */
  outline?: number;
  /** `marker` is whether the list it is in shows one. */
  list?: { id: string; level: number; marker: boolean };
  /** Text after a tab lines up at the right margin. */
  rightTab: boolean;
  /** Whether *all* of its text is bold, italic, or set in capitals. */
  bold: boolean;
  italic: boolean;
  caps: boolean;
  /** Of its largest text, in half-points. */
  size: number;
  /** In twips, a twentieth of a point. */
  spaceBefore: number;
  /** Across the page, as the paragraph or its style sets it; Word's own default is left. */
  align: DocxAlignment;
  /** Each link in its text, in order: whether all of its words are underlined. */
  links?: { underlined: boolean }[];
  source: DocxSource;
}

export type DocxAlignment = 'left' | 'center' | 'right' | 'justify';

/** A cell, and where it sits in the row's grid — merged cells span or continue. */
export interface DocxCell {
  blocks: DocxBlock[];
  column: number;
  span: number;
  /** Continuing a cell merged from above, so Word gives it no content of its own. */
  continued: boolean;
}

export interface DocxRow {
  cells: DocxCell[];
  columns: number;
}

export interface DocxTable {
  kind: 'table';
  rows: DocxRow[];
  source: DocxSource;
}

export type DocxBlock = DocxParagraph | DocxTable;

/**
 * Something the reader wants to say about the file:
 * - `unreadable`: content Mosaic couldn't read at all, such as a picture.
 * - `excluded`: content left out on purpose, by a rule written down here.
 * - `uncertain`: content read, but its place or meaning is a guess worth checking.
 */
export interface DocxNote {
  kind: 'unreadable' | 'excluded' | 'uncertain';
  message: string;
  /** Where in the file, when it is about one place. */
  where?: string;
}

export interface DocxDocument {
  blocks: DocxBlock[];
  notes: DocxNote[];
}

export const isParagraph = (block: DocxBlock): block is DocxParagraph => block.kind === 'paragraph';

/** Every paragraph in these blocks, tables included, in the order they are held. */
export function paragraphsOf(blocks: DocxBlock[]): DocxParagraph[] {
  const found: DocxParagraph[] = [];
  const stack = [...blocks].reverse();
  while (stack.length) {
    const block = stack.pop()!;
    if (isParagraph(block)) found.push(block);
    else {
      const inner = block.rows.flatMap((row) => row.cells.flatMap((cell) => cell.blocks));
      for (let i = inner.length - 1; i >= 0; i--) stack.push(inner[i]);
    }
  }
  return found;
}

/** Where a block is, in words for a warning: "a table in the page header". */
export function whereIs(source: DocxSource): string {
  const place = source.part === 'body' ? '' : ` in the page ${source.part}`;
  return `${source.at}${place}`;
}
