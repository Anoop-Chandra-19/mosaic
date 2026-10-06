import type { ProposalFlag } from '@shared/types/agent';

const SUPPORTING_ROLE =
  /\b(assisted|helped|participated|contributed|supported|was part of|part of the team|worked with|worked on|collaborated)\b/i;
const LEADING_ROLE =
  /\b(led|owned|spearheaded|drove|headed|directed|managed|architected|rewrote|built|designed|launched|delivered)\b/i;

/** A supporting role in `before` turned into a leading one in `after`: "Assisted in" → "Led". */
export function checkClaimsMore(before: string, after: string): ProposalFlag[] {
  const isPromoted =
    SUPPORTING_ROLE.test(before) &&
    !SUPPORTING_ROLE.test(after) &&
    LEADING_ROLE.test(after) &&
    !LEADING_ROLE.test(before);
  if (!isPromoted) return [];
  return [
    {
      kind: 'claimsMore',
      words: [before.match(SUPPORTING_ROLE)![0], after.match(LEADING_ROLE)![0]],
    },
  ];
}
