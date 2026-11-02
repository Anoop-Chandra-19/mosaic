/*
 * Controls how much streamed reply text is visible. Models send text in bursts, so revealing
 * each burst immediately causes abrupt updates. The reveal speed clears the pending text within
 * `MOST_BEHIND_MS` and never decreases while text is pending.
 */

export const MOST_BEHIND_MS = 500;

export interface TextPace {
  /** Reveal position in characters; may be fractional or fall inside a word. */
  shownTo: number;
  /** Zero once it has caught up. */
  charsPerMs: number;
}

/** Updates the pace for the current text length. A zero delay reveals all text on the next tick. */
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

/** Returns text through the last word boundary before `shownTo`, or all text once caught up. */
export function cutAtWordEnd(text: string, shownTo: number): string {
  if (shownTo >= text.length) return text;
  let end = Math.floor(shownTo);
  while (end > 0 && !/\s/.test(text[end])) end--;
  return text.slice(0, end);
}
