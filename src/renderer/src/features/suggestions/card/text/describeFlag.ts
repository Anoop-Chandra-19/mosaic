import type { ProposalFlag, ProposalFlagKind } from '@/types/agentProposal';

/*
 * What each check says about a suggestion, in the inspector and on its card, and which of
 * its words to underline in the suggested text.
 */

const quote = (word: string) => `“${word}”`;
const quoteAll = (words: readonly string[]) => words.map(quote).join(' and ');
const isOrAre = (words: readonly string[]) => (words.length === 1 ? 'is' : 'are');
const itOrThem = (words: readonly string[]) => (words.length === 1 ? 'it' : 'them');
const capitalize = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

/** For any kind: what it replaces, or where new text goes, is "here". */
const notYours = (words: readonly string[]) =>
  `You didn’t write ${quoteAll(words)} here, or ask for ${itOrThem(words)}.`;

const FLAG_SENTENCES: Record<ProposalFlagKind, (words: string[]) => string> = {
  unfilledGap: () => 'Only you know this number. Fill it in, or take the version without one.',
  claimsMore: ([from, to]) =>
    `${quote(capitalize(from))} became ${quote(capitalize(to))}. Keep it only if you led it.`,
  newNumbers: notYours,
  calculatedNumbers: (words) =>
    `${quoteAll(words)} ${isOrAre(words)} worked out from your numbers. Probably right, but check it.`,
  removedDetail: (words) => `Your bullet had ${quoteAll(words)}. This one doesn’t.`,
  newNames: notYours,
  doubledWords: (words) => `${quoteAll(words)} where the new text met the old.`,
};

export function describeFlag(flag: ProposalFlag): string {
  return FLAG_SENTENCES[flag.kind](flag.words);
}

/** The words a check is about that the suggested text has: everything but what it lost. */
const UNDERLINED: Record<ProposalFlagKind, (words: string[]) => string[]> = {
  unfilledGap: () => [],
  claimsMore: ([, to]) => [to],
  newNumbers: (words) => words,
  calculatedNumbers: (words) => words,
  removedDetail: () => [],
  newNames: (words) => words,
  doubledWords: (words) => words,
};

export function readFlaggedWords(flags: readonly ProposalFlag[]): string[] {
  return flags.flatMap((flag) => UNDERLINED[flag.kind](flag.words));
}

/** The details the bullet had that the suggestion lost, marked in the bullet as it is now. */
export function readLostWords(flags: readonly ProposalFlag[]): string[] {
  return flags.filter((flag) => flag.kind === 'removedDetail').flatMap((flag) => flag.words);
}
