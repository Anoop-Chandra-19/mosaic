import type { ProposalFlag } from '@shared/types/agent';
import { readNumbers } from './readNumbers';

/** A word, keeping the dots and signs inside names: Node.js, C++, C#, gRPC-Web. */
const WORD = /[A-Za-z0-9][A-Za-z0-9.+#'-]*[A-Za-z0-9+#]|[A-Za-z0-9]/g;

/**
 * The words that carry specifics: names and places (capitalised past the first word, which
 * is usually the verb), acronyms anywhere, and names with digits in them (S3, K8s).
 */
function isSpecificWord(word: string, index: number): boolean {
  return (
    /^[A-Z]{2,}/.test(word) ||
    /[A-Za-z]\d|\d[A-Za-z]/.test(word) ||
    (index > 0 && /^[A-Z]/.test(word))
  );
}

/** Names, places, acronyms and numbers `before` had that `after` dropped. */
export function checkRemovedDetail(before: string, after: string): ProposalFlag[] {
  const afterWords = new Set((after.match(WORD) ?? []).map((word) => word.toLowerCase()));
  const afterNumbers = readNumbers(after);
  const droppedWords = (before.match(WORD) ?? []).filter(
    (word, index) => isSpecificWord(word, index) && !afterWords.has(word.toLowerCase())
  );
  const droppedNumbers = [...readNumbers(before)].filter((number) => !afterNumbers.has(number));
  const dropped = [...new Set([...droppedWords, ...droppedNumbers])];
  return dropped.length ? [{ kind: 'removedDetail', words: dropped }] : [];
}
