import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import { parseResumeLines, type ParsedResume } from '../../parsing/parseResume';
import type { PdfDocument, PdfLink, PdfPage, PdfRun } from './pdfModel';
import { pdfLines } from './pdfLines';

/**
 * How much of a PDF Mosaic reads. A long CV runs to a few pages and a few thousand pieces
 * of text; these stop a file that is far more than any resume before it is all read.
 */
export const PDF_LIMITS = { pages: 30, runs: 30_000, links: 1_000 };

/** The file is a PDF, but more than `PDF_LIMITS` allows. */
export class PdfLimitError extends Error {}

/** The PDF is locked with a password. */
export class PdfPasswordError extends Error {}

/** The file isn't a PDF pdf.js can open. */
export class NotAPdfError extends Error {}

/** The PDF opens, but holds no text: a scan, or pictures of words. */
export class PdfHasNoTextError extends Error {}

/*
 * pdf.js's legacy build, in the app and in tests alike: its modern build uses JavaScript
 * newer than Node has, and one build means tests read files the way the app does.
 */
type PdfJs = typeof import('pdfjs-dist/legacy/build/pdf.mjs');

/**
 * A worker for pdf.js in the renderer, so a slow file can't freeze the window. Vite bundles
 * it as the app's own file: pdf.js left to load its worker by URL would, under file://,
 * wrap it in a blob: script, which the content security policy refuses. Outside a browser
 * window — tests, scripts — pdf.js reads on the calling thread.
 */
async function workerFor(pdfjs: PdfJs) {
  if (typeof window === 'undefined' || typeof Worker === 'undefined') return undefined;
  const { default: PdfJsWorker } =
    await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?worker');
  const port = new PdfJsWorker();
  // pdf.js documents `port` as a Worker, but its generated types say only null.
  const worker = new pdfjs.PDFWorker({ port: port as unknown as null });
  return {
    worker,
    end: () => {
      worker.destroy();
      port.terminate();
    },
  };
}

interface FontStyle {
  bold: boolean;
  italic: boolean;
  name: string;
  /** Each character's glyph width, when the font says. */
  widths?: Map<string, number>;
}

/** What pdf.js hands over about a font, with `fontExtraProperties` on. */
interface PdfJsFont {
  name?: string;
  bold?: boolean;
  black?: boolean;
  italic?: boolean;
  /** Glyph widths by character code. */
  widths?: Record<string, number>;
  /** The text each character code stands for. */
  toUnicode?: { _map?: Record<string, unknown> };
}

/** Glyph widths by the text they draw: the font's widths, through its codes' meanings. */
function readGlyphWidths(font: PdfJsFont | undefined): Map<string, number> | undefined {
  const byCode = font?.widths;
  const meanings = font?.toUnicode?._map;
  if (!byCode || !meanings) return undefined;
  const widths = new Map<string, number>();
  for (const [code, text] of Object.entries(meanings)) {
    const width = byCode[code];
    if (typeof text === 'string' && typeof width === 'number' && width > 0) {
      widths.set(text, width);
    }
  }
  return widths.size > 0 ? widths : undefined;
}

/**
 * Each UTF-16 unit's share of a run's width, or undefined when the font can't say. A
 * character the font has no width for takes the average of those it has.
 */
function computeCharacterWidthShares(
  text: string,
  widths: Map<string, number> | undefined
): number[] | undefined {
  if (!widths) return undefined;
  const known = [...text].map((char) => widths.get(char));
  const found = known.filter((width): width is number => width !== undefined);
  if (found.length === 0) return undefined;
  const average = found.reduce((sum, width) => sum + width, 0) / found.length;
  const total = known.reduce<number>((sum, width) => sum + (width ?? average), 0);
  return [...text].flatMap((char, index) => {
    const share = (known[index] ?? average) / total;
    // A character outside the Basic Multilingual Plane is two units; the first takes it all.
    return char.length === 2 ? [share, 0] : [share];
  });
}

/**
 * How a font is set. pdf.js knows once it has read the page's drawing instructions, which
 * load each font's details; text content alone names fonts only by an id.
 */
async function fontsOf(page: PDFPageProxy, ids: Set<string>): Promise<Map<string, FontStyle>> {
  await page.getOperatorList();
  const fonts = new Map<string, FontStyle>();
  for (const id of ids) {
    const font = page.commonObjs.has(id) ? (page.commonObjs.get(id) as PdfJsFont) : undefined;
    const name = font?.name ?? id;
    // pdf.js reads weight and slant from a font's flags, which embedded fonts often leave
    // unset; the name ("LiberationSerif-Bold") still says.
    fonts.set(id, {
      bold: Boolean(font?.bold || font?.black) || /bold|black|heavy/i.test(name),
      italic: Boolean(font?.italic) || /italic|oblique/i.test(name),
      name,
      widths: readGlyphWidths(font),
    });
  }
  return fonts;
}

interface Budget {
  runs: number;
  links: number;
}

async function readPage(page: PDFPageProxy, budget: Budget): Promise<PdfPage> {
  const [left, bottom, right, top] = page.view;
  const content = await page.getTextContent();
  const items = content.items.filter((item): item is TextItem => 'str' in item && item.str !== '');
  budget.runs -= items.length;
  if (budget.runs < 0) throw new PdfLimitError('This PDF holds more text than Mosaic reads.');

  const fonts = await fontsOf(page, new Set(items.map((item) => item.fontName)));
  const runs: PdfRun[] = items.map((item) => {
    const [a, b, c, d, e, f] = item.transform as number[];
    const font = fonts.get(item.fontName)!;
    const shares = computeCharacterWidthShares(item.str, font.widths);
    return {
      text: item.str,
      x: e - left,
      y: top - f,
      width: item.width,
      ...(shares && { shares }),
      size: Math.hypot(c, d),
      bold: font.bold,
      italic: font.italic,
      font: font.name,
      upright: a > 0 && d > 0 && b === 0 && c === 0,
    };
  });

  const links: PdfLink[] = [];
  for (const annotation of await page.getAnnotations()) {
    // pdf.js sets `url` only for an address it accepts as absolute, tidied ("ada.dev/");
    // `unsafeUrl` is the address as the file writes it, taken only once pdf.js accepts it.
    if (annotation.subtype !== 'Link' || typeof annotation.url !== 'string') continue;
    const url = typeof annotation.unsafeUrl === 'string' ? annotation.unsafeUrl : annotation.url;
    if (--budget.links < 0) throw new PdfLimitError('This PDF holds more links than Mosaic reads.');
    const [x1, y1, x2, y2] = annotation.rect as number[];
    links.push({
      url,
      left: Math.min(x1, x2) - left,
      right: Math.max(x1, x2) - left,
      top: top - Math.max(y1, y2),
      bottom: top - Math.min(y1, y2),
    });
  }
  return { width: right - left, height: top - bottom, runs, links };
}

async function readPages(document: PDFDocumentProxy): Promise<PdfDocument> {
  if (document.numPages > PDF_LIMITS.pages) {
    throw new PdfLimitError(`This PDF has more than ${PDF_LIMITS.pages} pages.`);
  }
  const budget: Budget = { runs: PDF_LIMITS.runs, links: PDF_LIMITS.links };
  const pages: PdfPage[] = [];
  for (let number = 1; number <= document.numPages; number++) {
    const page = await document.getPage(number);
    try {
      pages.push(await readPage(page, budget));
    } finally {
      page.cleanup();
    }
  }
  return { pages, notes: [] };
}

/** What a PDF holds: its pages' text, where each piece sits, and its links. */
export async function readPdfContent(bytes: Uint8Array): Promise<PdfDocument> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const worker = await workerFor(pdfjs);
  const task = pdfjs.getDocument({
    // pdf.js takes ownership of the buffer it is given, so it gets a copy.
    data: bytes.slice(),
    worker: worker?.worker,
    verbosity: pdfjs.VerbosityLevel.ERRORS,
    // Text is all that is read: no fonts installed into the page, nothing fetched — but each
    // font's glyph widths, which say where in a run each word sits.
    fontExtraProperties: true,
    disableFontFace: true,
    useSystemFonts: false,
    useWorkerFetch: false,
    useWasm: false,
    isOffscreenCanvasSupported: false,
    isImageDecoderSupported: false,
    enableXfa: false,
  });
  try {
    const document = await task.promise.catch((error: unknown) => {
      const name = error instanceof Error ? error.name : '';
      if (name === 'PasswordException') throw new PdfPasswordError('This PDF is locked.');
      throw new NotAPdfError(error instanceof Error ? error.message : String(error));
    });
    const content = await readPages(document);
    const hasText = content.pages.some((page) => page.runs.some((run) => run.text.trim()));
    if (!hasText) throw new PdfHasNoTextError('This PDF has no text in it.');
    return content;
  } finally {
    await task.destroy();
    worker?.end();
  }
}

/** A PDF as a resume to review. */
export async function readPdf(bytes: Uint8Array): Promise<ParsedResume> {
  const { lines, notes, leftOut } = pdfLines(await readPdfContent(bytes));
  const parsed = parseResumeLines(lines);
  parsed.warnings.push(...notes.map((note) => note.message));
  parsed.leftOut.push(...leftOut);
  return parsed;
}
