/**
 * The full view renders a range of the history, not a prefix of it: jumping to v17 of
 * 2,041 moves the range to v17 instead of mounting the 2,024 rows above it. Indexes
 * count matches, newest first; `to` is exclusive.
 */
export interface VisibleRange {
  from: number;
  to: number;
}

/** Rows a range starts with, and rows a revealed version gets below it. */
export const VISIBLE_RANGE_ROWS = 150;
/** Rows "Show earlier" and "Show newer" add. */
export const VISIBLE_RANGE_STEP = 400;
/** Rows kept above a revealed version, so it does not land on the range's edge. */
const REVEAL_CONTEXT_ROWS = 40;
/** Closer than this to an edge counts as outside: the row would sit against "Show …". */
const EDGE_ROWS = 2;

export const NEWEST_RANGE: VisibleRange = { from: 0, to: VISIBLE_RANGE_ROWS };

/** The range cut to what there is: never past the end, never empty while there are rows. */
export function clampVisibleRange({ from, to }: VisibleRange, total: number): VisibleRange {
  const clampedTo = Math.min(to, total);
  return { from: Math.min(from, Math.max(0, clampedTo - 1)), to: clampedTo };
}

/** The range moved to hold `index`, or unchanged when it already comfortably does. */
export function revealInVisibleRange(range: VisibleRange, index: number): VisibleRange {
  const isInside =
    index >= range.from + (range.from > 0 ? EDGE_ROWS : 0) && index < range.to - EDGE_ROWS;
  if (isInside) return range;
  return { from: Math.max(0, index - REVEAL_CONTEXT_ROWS), to: index + VISIBLE_RANGE_ROWS };
}

export function showEarlierInVisibleRange(range: VisibleRange): VisibleRange {
  return { ...range, to: range.to + VISIBLE_RANGE_STEP };
}

export function showNewerInVisibleRange(range: VisibleRange): VisibleRange {
  return { ...range, from: Math.max(0, range.from - VISIBLE_RANGE_STEP) };
}
