// No imports: the eval scripts load this with plain Node.

const loosenPhrase = (text: string) =>
  text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ');

const WORD_CHARACTER = /[\p{L}\p{N}]/u;

/**
 * Whether `find` sits at `start` as words of its own: "Go" in "in Go," but not in "Google".
 * Only an edge that is itself a letter or digit needs a boundary, so "C++" still matches in
 * "C++ code".
 */
function isWholeWordAt(text: string, find: string, start: number): boolean {
  const end = start + find.length;
  const needsBoundaryBefore = WORD_CHARACTER.test(find[0] ?? '');
  const needsBoundaryAfter = WORD_CHARACTER.test(find[find.length - 1] ?? '');
  const isBoundaryBefore = start === 0 || !WORD_CHARACTER.test(text[start - 1]);
  const isBoundaryAfter = end === text.length || !WORD_CHARACTER.test(text[end]);
  return (!needsBoundaryBefore || isBoundaryBefore) && (!needsBoundaryAfter || isBoundaryAfter);
}

function findStarts(text: string, find: string, isWholeWord: boolean): number[] {
  const starts: number[] = [];
  for (let start = text.indexOf(find); start !== -1; start = text.indexOf(find, start + 1)) {
    if (!isWholeWord || isWholeWordAt(text, find, start)) starts.push(start);
  }
  return starts;
}

export interface PhraseSpan {
  start: number;
  end: number;
  isLoose: boolean;
}

/**
 * Every place `find` sits in `text`, in order: exact matches, or when there are none, ones
 * forgiving of curly quotes, dashes, and runs of spaces. Loosening replaces characters one
 * for one or collapses spaces, so indexes line up with the original for text written with
 * single spaces, which is all a bullet holds.
 */
function locateEvery(text: string, find: string, isWholeWord: boolean): PhraseSpan[] {
  const exactStarts = findStarts(text, find, isWholeWord);
  if (exactStarts.length) {
    return exactStarts.map((start) => ({ start, end: start + find.length, isLoose: false }));
  }
  const looseFind = loosenPhrase(find);
  return findStarts(loosenPhrase(text), looseFind, isWholeWord).map((start) => ({
    start,
    end: start + looseFind.length,
    isLoose: true,
  }));
}

/** Every place `find` sits in `text` as words of its own. Used to rename a term throughout. */
export const locateEveryWholeWord = (text: string, find: string) => locateEvery(text, find, true);

/** Every place `find` sits in `text`, inside words too. */
export const locateEveryPhrase = (text: string, find: string) => locateEvery(text, find, false);

/** Where `find` sits in `text`, if it sits there once. */
export function locatePhrase(text: string, find: string): PhraseSpan | 'none' | 'many' {
  const spans = locateEveryPhrase(text, find);
  if (spans.length > 1) return 'many';
  return spans[0] ?? 'none';
}
