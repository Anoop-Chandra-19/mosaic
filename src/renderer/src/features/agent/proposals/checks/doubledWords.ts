import type { ProposalFlag } from '@shared/types/agent';
import { diffWords } from '../diffWords';

interface PlacedWord {
  word: string;
  start: number;
  end: number;
}

function placeWords(text: string): PlacedWord[] {
  return [...text.matchAll(/[A-Za-z][A-Za-z'-]*/g)].map((match) => ({
    word: match[0],
    start: match.index,
    end: match.index + match[0].length,
  }));
}

/** Rough on purpose: "reduced" and "reduce" share "reduc", which is all this needs. */
function stemWord(word: string): string {
  const lower = word.toLowerCase();
  return lower.length > 4 ? lower.replace(/(ing|ed|es|e|s|d)$/, '') : lower;
}

/** Where in `after` the edit put new text. */
function findAddedRanges(before: string, after: string): [number, number][] {
  const ranges: [number, number][] = [];
  let at = 0;
  for (const part of diffWords(before, after)) {
    if (part.kind === 'removed') continue;
    if (part.kind === 'added') ranges.push([at, at + part.text.length]);
    at += part.text.length;
  }
  return ranges;
}

/**
 * The same word, or the same word in another form, twice in a row where the edit joined
 * old text to new: "Reduced reduce", "the the". Doubles the user wrote stay theirs.
 */
export function checkDoubledWords(before: string, after: string): ProposalFlag[] {
  const added = findAddedRanges(before, after);
  const touchesEdit = (word: PlacedWord) =>
    added.some(([start, end]) => word.start < end && word.end > start);
  const words = placeWords(after);
  const doubled: string[] = [];
  for (let index = 1; index < words.length; index++) {
    const [first, second] = [words[index - 1], words[index]];
    const isSeparatedBySpace = /^\s+$/.test(after.slice(first.end, second.start));
    if (!isSeparatedBySpace || stemWord(first.word) !== stemWord(second.word)) continue;
    if (touchesEdit(first) || touchesEdit(second)) doubled.push(`${first.word} ${second.word}`);
  }
  return doubled.length ? [{ kind: 'doubledWords', words: doubled }] : [];
}
