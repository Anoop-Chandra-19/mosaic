import type { ProposalFlag } from '@/types/agentProposal';
import { readSpecificWords, readWordSet } from './readSpecificWords';

/**
 * Names, places, tools and acronyms in `after` that are in neither `before` nor what the
 * user asked: an invented employer or tool is what a resume can least afford.
 */
export function checkNewNames(before: string, after: string, requestText: string): ProposalFlag[] {
  const known = readWordSet(`${before}\n${requestText}`);
  const fresh = readSpecificWords(after).filter((word) => !known.has(word.toLowerCase()));
  const words = [...new Set(fresh)];
  return words.length ? [{ kind: 'newNames', words }] : [];
}
