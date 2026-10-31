/*
 * How much of a reply to show while it streams. Models send text in bursts; shown as it comes,
 * it lurches and redraws the whole reply for each piece. So the shown length moves at a steady
 * speed, fast enough to clear what has arrived in `MOST_BEHIND_MS`, and only ever rises while
 * there is text waiting, which keeps every character inside that limit.
 */

export const MOST_BEHIND_MS = 500;

export interface TextPace {
  /** How far along the text it has got, which can fall inside a word. */
  shownTo: number;
  /** Zero once it has caught up. */
  charsPerMs: number;
}

/** The text is now this long. With no time allowed behind, the next tick shows all of it. */
export function noteArrival(pace: TextPace, length: number, mostBehindMs: number): TextPace {
  const shownTo = Math.min(pace.shownTo, length);
  const waiting = length - shownTo;
  if (waiting === 0) return { shownTo, charsPerMs: 0 };
  return { shownTo, charsPerMs: Math.max(pace.charsPerMs, waiting / mostBehindMs) };
}

export function advancePace(pace: TextPace, length: number, elapsedMs: number): TextPace {
  const shownTo = Math.min(length, pace.shownTo + pace.charsPerMs * elapsedMs);
  return { shownTo, charsPerMs: shownTo === length ? 0 : pace.charsPerMs };
}

/** The text up to the last whole word `shownTo` has passed; all of it once it has caught up. */
export function cutAtWordEnd(text: string, shownTo: number): string {
  if (shownTo >= text.length) return text;
  let end = Math.floor(shownTo);
  while (end > 0 && !/\s/.test(text[end])) end--;
  return text.slice(0, end);
}
