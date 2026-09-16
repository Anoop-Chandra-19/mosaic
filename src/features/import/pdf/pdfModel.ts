/**
 * What a PDF holds, as read from it — not yet what any of it means. `readPdf` fills this in
 * from pdf.js: every piece of text with where it sits and how it is set, and every link.
 * `pdfLines` is what turns it into a resume, so every guess about meaning — which pieces
 * make a line, which lines are headings — is made there, with the whole document in view.
 *
 * Positions are in points from the page's top-left corner; `y` is a run's baseline.
 */

/** A piece of text as the PDF draws it: one or more words in one font. */
export interface PdfRun {
  text: string;
  x: number;
  y: number;
  width: number;
  /** The font size, in points. */
  size: number;
  bold: boolean;
  italic: boolean;
  /** The font's name, to tell looks apart where bold and italic don't. */
  font: string;
  /** Set on the page upright. Sideways text is kept, so leaving it out can be said. */
  upright: boolean;
}

/** An area of the page that links to an address. */
export interface PdfLink {
  url: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface PdfPage {
  width: number;
  height: number;
  runs: PdfRun[];
  links: PdfLink[];
}

/**
 * Something to say about the file:
 * - `unreadable`: content Mosaic couldn't read at all.
 * - `excluded`: content left out on purpose, by a rule written down here.
 * - `uncertain`: content read, but its place or meaning is a guess worth checking.
 */
export interface PdfNote {
  kind: 'unreadable' | 'excluded' | 'uncertain';
  message: string;
}

export interface PdfDocument {
  pages: PdfPage[];
  notes: PdfNote[];
}
