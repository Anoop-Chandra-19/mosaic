// No imports: the eval scripts load this with plain Node.

const loosenPhrase = (text: string) =>
  text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ');

const WORD_CHARACTER = /[\p{L}\p{N}]/u;

/**
 * Check whole-word boundaries for `find` at `start`: "Go" matches "in Go," but not
 * "Google". Require a boundary only when that edge of `find` is a letter or digit,
 * so "C++" still matches "C++ code".
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
 * Return matches in text order. Prefer exact matches; if none exist, normalize curly
 * quotes, dashes, and whitespace. Quote and dash substitutions preserve length, but
 * collapsing whitespace does not. Returned offsets match the original text only when
 * its whitespace is already normalized, as expected for bullet text.
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

/** Find all whole-word matches for renaming a term throughout the text. */
export const locateEveryWholeWord = (text: string, find: string) => locateEvery(text, find, true);

/** Find all phrase matches, including matches inside words. */
export const locateEveryPhrase = (text: string, find: string) => locateEvery(text, find, false);

/** Return the unique phrase match, or distinguish no matches from multiple matches. */
export function locatePhrase(text: string, find: string): PhraseSpan | 'none' | 'many' {
  const spans = locateEveryPhrase(text, find);
  if (spans.length > 1) return 'many';
  return spans[0] ?? 'none';
}
