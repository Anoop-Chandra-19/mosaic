import { describe, expect, it } from 'vitest';
import { makeProposal } from '@/features/suggestions/proposals/__tests__/proposalFixtures';
import { applyProposalsToResume } from '@/features/suggestions/proposals/apply/applyProposalsToResume';
import { checkProposal } from '@/features/suggestions/proposals/checks/checkProposal';
import { validateProposal } from '@/features/suggestions/proposals/validateProposal';
import type { ProposalFlagKind } from '@/types/agentProposal';
import { createExampleResume } from '../exampleResume';
import { createExampleSuggestions, EXAMPLE_REQUEST } from '../exampleSuggestions';

const EXAMPLE_SUGGESTIONS = createExampleSuggestions();

/** Check each suggestion against the working copy with the earlier ones applied, as staging does. */
function stageInOrder() {
  let copy = createExampleResume();
  return EXAMPLE_SUGGESTIONS.map(({ change }, index) => {
    const refusal = validateProposal(copy, change);
    const flags = checkProposal(copy, change, EXAMPLE_REQUEST);
    copy = applyProposalsToResume(copy, [makeProposal(change, `p${index}`)]).doc;
    return { refusal, flags };
  });
}

describe('the example suggestions', () => {
  it('all fit the example resume when staged in order', () => {
    const refused = stageInOrder().map(({ refusal }) => refusal);

    expect(refused).toEqual(EXAMPLE_SUGGESTIONS.map(() => null));
  });

  it('cover every kind and every check', () => {
    const kinds = new Set(EXAMPLE_SUGGESTIONS.map(({ change }) => change.kind));
    const flags = new Set<ProposalFlagKind>(
      stageInOrder().flatMap(({ flags: found }) => found.map((flag) => flag.kind))
    );

    expect([...kinds].sort()).toEqual([
      'add',
      'entry',
      'merge',
      'rename',
      'reorder',
      'rewrite',
      'section',
      'select',
      'split',
    ]);
    expect([...flags].sort()).toEqual([
      'calculatedNumbers',
      'claimsMore',
      'doubledWords',
      'newNames',
      'newNumbers',
      'removedDetail',
      'unfilledGap',
    ]);
  });
});
