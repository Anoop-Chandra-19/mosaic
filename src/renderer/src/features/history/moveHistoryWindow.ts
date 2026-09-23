/**
 * The full view renders a window over the history, not a prefix of it: jumping to v17 of
 * 2,041 moves the window to v17 instead of mounting the 2,024 rows above it. Indexes
 * count matches, newest first; `to` is exclusive.
 */
export interface HistoryWindow {
  from: number;
  to: number;
}

/** Rows a window starts with, and rows a revealed version gets below it. */
export const WINDOW_ROWS = 150;
/** Rows "Show earlier" and "Show newer" add. */
export const WINDOW_STEP = 400;
/** Rows kept above a revealed version, so it does not land on the window's edge. */
const REVEAL_CONTEXT_ROWS = 40;
/** Closer than this to an edge counts as outside: the row would sit against "Show …". */
const EDGE_ROWS = 2;

export const NEWEST_WINDOW: HistoryWindow = { from: 0, to: WINDOW_ROWS };

/** The window cut to what there is: never past the end, never empty while there are rows. */
export function clampHistoryWindow({ from, to }: HistoryWindow, total: number): HistoryWindow {
  const clampedTo = Math.min(to, total);
  return { from: Math.min(from, Math.max(0, clampedTo - 1)), to: clampedTo };
}

/** The window moved to hold `index`, or unchanged when it already comfortably does. */
export function revealInHistoryWindow(window: HistoryWindow, index: number): HistoryWindow {
  const isInside =
    index >= window.from + (window.from > 0 ? EDGE_ROWS : 0) && index < window.to - EDGE_ROWS;
  if (isInside) return window;
  return { from: Math.max(0, index - REVEAL_CONTEXT_ROWS), to: index + WINDOW_ROWS };
}

export function showEarlierInHistoryWindow(window: HistoryWindow): HistoryWindow {
  return { ...window, to: window.to + WINDOW_STEP };
}

export function showNewerInHistoryWindow(window: HistoryWindow): HistoryWindow {
  return { ...window, from: Math.max(0, window.from - WINDOW_STEP) };
}
