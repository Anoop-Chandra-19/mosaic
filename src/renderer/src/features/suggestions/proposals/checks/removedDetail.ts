import type { ProposalFlag } from '@/types/agentProposal';
import { readNumbers } from './readNumbers';
import { readSpecificWords, readWordSet } from './readSpecificWords';

/** Names, places, acronyms and numbers `before` had that `after` dropped. */
export function checkRemovedDetail(before: string, after: string): ProposalFlag[] {
  const afterWords = readWordSet(after);
  const afterNumbers = readNumbers(after);
  const droppedWords = readSpecificWords(before).filter(
    (word) => !afterWords.has(word.toLowerCase())
  );
  const droppedNumbers = [...readNumbers(before)].filter((number) => !afterNumbers.has(number));
  const dropped = [...new Set([...droppedWords, ...droppedNumbers])];
  return dropped.length ? [{ kind: 'removedDetail', words: dropped }] : [];
}
