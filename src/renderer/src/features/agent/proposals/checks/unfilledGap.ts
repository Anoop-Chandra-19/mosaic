import type { ProposalFlag } from '@shared/types/agent';

/** Where a rewrite wants a number only the user knows. */
export const GAP_MARK = '{{?}}';

/** A gap still in the text: it can't apply until the user fills it or takes the version without. */
export function checkUnfilledGap(_before: string, after: string): ProposalFlag[] {
  return after.includes(GAP_MARK) ? [{ kind: 'unfilledGap', words: [GAP_MARK] }] : [];
}
