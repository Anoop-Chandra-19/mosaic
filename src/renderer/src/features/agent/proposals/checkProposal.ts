import type { ProposalChange, ProposalFlag } from '@shared/types/agentProposal';
import { checkClaimsMore } from './checks/claimsMore';
import { checkDoubledWords } from './checks/doubledWords';
import { checkNewNumbers } from './checks/newNumbers';
import { checkRemovedDetail } from './checks/removedDetail';
import { checkUnfilledGap } from './checks/unfilledGap';

type TextCheck = (before: string, after: string, requestText: string) => ProposalFlag[];

const TEXT_CHECKS: TextCheck[] = [
  checkDoubledWords,
  checkClaimsMore,
  checkNewNumbers,
  checkRemovedDetail,
  checkUnfilledGap,
];

/** The text a change replaces and the text it writes; null when it writes none. */
function readCheckedText(change: ProposalChange): { before: string; after: string } | null {
  switch (change.kind) {
    case 'rewrite':
      return { before: change.before, after: change.after };
    case 'merge':
      return { before: change.before.join(' '), after: change.after };
    case 'entry':
      return { before: '', after: change.bullets.join('\n') };
    default:
      return null;
  }
}

/** What the local checks notice about a change, in the order the card lists them. */
export function checkProposal(change: ProposalChange, requestText: string): ProposalFlag[] {
  const text = readCheckedText(change);
  if (!text) return [];
  return TEXT_CHECKS.flatMap((check) => check(text.before, text.after, requestText));
}
