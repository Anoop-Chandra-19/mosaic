/** The rule `resumeStore.splitBullet` enforces: both halves keep some text. */
export function canSplitAt(text: string, splitIndex: number): boolean {
  return text.slice(0, splitIndex).trim() !== '' && text.slice(splitIndex).trim() !== '';
}

export function canSplitText(text: string): boolean {
  return /\S\s+\S/.test(text);
}

/** After a sentence or semicolon, nearest the middle; not in the outer fifths. -1 if none. */
export function findSentenceBreakNearMiddle(text: string): number {
  const earliestSplit = text.length * 0.2;
  const latestSplit = text.length * 0.8;
  return findBreakNearMiddle(
    text,
    /[.;]\s+(?=\S)/g,
    (splitIndex) => splitIndex >= earliestSplit && splitIndex <= latestSplit
  );
}

/** Prefer a sentence break, then a word break near the middle; use the end if neither exists. */
export function findSplitStart(text: string): number {
  const sentenceBreakIndex = findSentenceBreakNearMiddle(text);
  if (sentenceBreakIndex > 0) return sentenceBreakIndex;

  const wordBreakIndex = findBreakNearMiddle(text, /\s+/g, (splitIndex) =>
    canSplitAt(text, splitIndex)
  );
  return wordBreakIndex === -1 ? text.length : wordBreakIndex;
}

function findBreakNearMiddle(
  text: string,
  breakPattern: RegExp,
  isValidSplit: (splitIndex: number) => boolean
): number {
  const midpoint = text.length / 2;
  let splitIndex = -1;
  let closestDistanceToMiddle = Infinity;

  for (const match of text.matchAll(breakPattern)) {
    const candidateIndex = match.index + match[0].length;
    const distanceToMiddle = Math.abs(candidateIndex - midpoint);
    if (distanceToMiddle < closestDistanceToMiddle && isValidSplit(candidateIndex)) {
      closestDistanceToMiddle = distanceToMiddle;
      splitIndex = candidateIndex;
    }
  }
  return splitIndex;
}

export function describeSplitRefusal(text: string, splitIndex: number): string | null {
  if (canSplitAt(text, splitIndex)) return null;
  if (!text.trim()) return 'The bullet is empty, so there is nothing to split.';
  if (!text.slice(0, splitIndex).trim()) {
    return 'The cursor is at the start. Move it to where the new bullet should begin.';
  }
  return 'The cursor is at the end. Move it to where the new bullet should begin.';
}

export function joinBulletTexts(first: string, second: string): { text: string; seam: number } {
  const head = first.trim();
  const tail = second.trim();
  return { text: head && tail ? `${head} ${tail}` : head + tail, seam: head.length };
}

/** Track the seam for a contiguous edit, using the cursor position after the edit. */
export function moveSeamWithEdit(
  seam: number,
  textBeforeEdit: string,
  textAfterEdit: string,
  cursorAfterEdit: number
): number {
  const lengthChange = textAfterEdit.length - textBeforeEdit.length;
  const editStart = lengthChange > 0 ? cursorAfterEdit - lengthChange : cursorAfterEdit;
  if (editStart >= seam) return seam;

  const shiftedSeam = seam + lengthChange;
  if (lengthChange < 0) {
    // A deletion spanning the seam leaves it at the start of the deleted text.
    return Math.max(editStart, shiftedSeam);
  }
  return shiftedSeam;
}
