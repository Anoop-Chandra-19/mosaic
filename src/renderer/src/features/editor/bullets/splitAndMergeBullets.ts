/** The rule `resumeStore.splitBullet` enforces: both halves keep some text. */
export function canSplitAt(text: string, at: number): boolean {
  return text.slice(0, at).trim() !== '' && text.slice(at).trim() !== '';
}

export function canSplitText(text: string): boolean {
  return /\S\s+\S/.test(text);
}

/** After a sentence or semicolon, nearest the middle; not in the outer fifths. -1 if none. */
export function findSentenceBreakNearMiddle(text: string): number {
  const length = text.length;
  let best = -1;
  let bestDistance = Infinity;
  for (const match of text.matchAll(/[.;]\s+(?=\S)/g)) {
    const at = match.index + match[0].length;
    if (at < length * 0.2 || at > length * 0.8) continue;
    const distance = Math.abs(at - length / 2);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = at;
    }
  }
  return best;
}

/** A sentence break, or else the word break nearest the middle. */
export function findSplitStart(text: string): number {
  const sentence = findSentenceBreakNearMiddle(text);
  if (sentence > 0) return sentence;
  let best = text.length;
  let bestDistance = Infinity;
  for (const match of text.matchAll(/\s+/g)) {
    const at = match.index + match[0].length;
    const distance = Math.abs(at - text.length / 2);
    if (distance < bestDistance && canSplitAt(text, at)) {
      bestDistance = distance;
      best = at;
    }
  }
  return best;
}

export function describeSplitRefusal(text: string, at: number): string | null {
  if (canSplitAt(text, at)) return null;
  if (!text.trim()) return 'The bullet is empty, so there is nothing to split.';
  if (!text.slice(0, at).trim()) {
    return 'The cursor is at the start. Move it to where the new bullet should begin.';
  }
  return 'The cursor is at the end. Move it to where the new bullet should begin.';
}

export function joinBulletTexts(first: string, second: string): { text: string; seam: number } {
  const head = first.trim();
  const tail = second.trim();
  return { text: head && tail ? `${head} ${tail}` : head + tail, seam: head.length };
}

/** An edit before the seam moves it; one after leaves it. */
export function moveSeamWithEdit(
  seam: number,
  before: string,
  after: string,
  cursor: number
): number {
  const delta = after.length - before.length;
  const editStart = delta > 0 ? cursor - delta : cursor;
  if (editStart >= seam) return seam;
  return delta < 0 ? Math.max(editStart, seam + delta) : seam + delta;
}
