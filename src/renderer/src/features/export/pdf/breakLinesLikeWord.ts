import { HEADLESS_LAYOUT } from '@/lib/resume/headlessLayout';

/** The width of a run of text, in points. */
export type MeasureTextWidth = (text: string) => number;

/**
 * Where a line may end: after a space, or after a hyphen inside a word ("on-" / "call"), as
 * Word and browsers allow. Not before a digit, so "COVID-19" and "10-20" stay whole.
 */
const LINE_BREAK_CHANCE = /(?<= )|(?<=[\p{L}\p{N}]-)(?=[^\s\d])/u;

/**
 * Where each line starts, as offsets into the text, breaking where Word does: each line takes
 * words until the next one would pass `width`, with spaces at their own width. A line break
 * already in the text starts a line too. Left to itself react-pdf squeezes spaces by up to
 * half to fit one more word, so its pages hold more than Word's or the preview's.
 */
export function findLineStarts(text: string, width: number, measure: MeasureTextWidth): number[] {
  const starts = [0];
  let offset = 0;
  text.split('\n').forEach((paragraph, index) => {
    if (index > 0) starts.push(offset);
    let line = '';
    for (const piece of paragraph.split(LINE_BREAK_CHANCE)) {
      // Spaces at the end of a line take no room, as in Word.
      if (line.trim() && measure((line + piece).trimEnd()) > width) {
        starts.push(offset);
        line = piece;
      } else {
        line += piece;
      }
      offset += piece.length;
    }
    offset += 1;
  });
  return starts;
}

/** The text with a line break wherever Word ends a line, and the spaces there dropped. */
export function breakLinesLikeWord(text: string, width: number, measure: MeasureTextWidth): string {
  const starts = findLineStarts(text, width, measure);
  return starts
    .map((start, index) => {
      const line = text.slice(start, starts[index + 1] ?? text.length);
      return line.endsWith('\n') ? line.slice(0, -1) : line.trimEnd();
    })
    .join('\n');
}

/**
 * Runs of one line of text (a header's items and the separators between them), cut where
 * Word ends each line. A run that starts a line says so; spaces before it are dropped.
 */
export function breakRunsLikeWord<Run extends { text: string }>(
  runs: Run[],
  width: number,
  measure: MeasureTextWidth
): (Run & { startsLine: boolean })[] {
  const starts = new Set(findLineStarts(runs.map((run) => run.text).join(''), width, measure));
  const pieces: (Run & { startsLine: boolean })[] = [];
  let offset = 0;
  for (const run of runs) {
    let from = 0;
    for (let at = 1; at <= run.text.length; at++) {
      if (at < run.text.length && !starts.has(offset + at)) continue;
      pieces.push({
        ...run,
        text: run.text.slice(from, at),
        startsLine: starts.has(offset + from) && offset + from > 0,
      });
      from = at;
    }
    offset += run.text.length;
  }
  for (let index = 1; index < pieces.length; index++) {
    if (!pieces[index].startsLine) continue;
    for (let before = index - 1; before >= 0; before--) {
      pieces[before].text = pieces[before].text.trimEnd();
      if (pieces[before].text) break;
    }
  }
  return pieces.filter((piece) => piece.text);
}

/**
 * Measures text at a size in the preview's font, which sets text as the PDF's Helvetica and
 * Word's Arial do. Null where there is no canvas, as in unit tests.
 */
export function createTextMeasurer(fontSize: number): MeasureTextWidth | null {
  if (typeof document === 'undefined') return null;
  const context = document.createElement('canvas').getContext('2d');
  if (!context) return null;
  context.font = `${fontSize}px ${HEADLESS_LAYOUT.fontStack}`;
  // Word doesn't kern, and neither does the preview.
  context.fontKerning = 'none';
  return (text) => context.measureText(text).width;
}
