import { describe, expect, it } from 'vitest';
import type { Proposal, ProposalVersion } from '@/types/agentProposal';
import { makeProposal, rewrite } from '../proposals/__tests__/proposalFixtures';
import { labelLateAddition, labelSuggestionState } from '../suggestionState';

const B1 = 'Assisted in migrating billing to Postgres';

/**
 * A rewrite suggestion with `count` versions. The first version, `p1-v1`, is kept and has
 * the fields given in `kept`.
 */
function keptCard(count: number, kept: Partial<ProposalVersion> = {}): Proposal {
  const card = makeProposal(rewrite('b1', B1, 'Led the billing migration'), 'p1', kept);
  const [first] = card.versions;
  const later = Array.from({ length: count - 1 }, (_, index) => ({
    ...first,
    id: `p1-v${index + 2}`,
    review: {},
    flags: [],
  }));
  return { ...card, versions: [first, ...later] };
}

describe('labelSuggestionState', () => {
  it('names the kept version and the newest waiting one', () => {
    expect(labelSuggestionState(keptCard(3))).toBe('kept, version 1 · version 3 waiting');
  });

  it('says a kept version is held for its number, or in the user’s words', () => {
    const held = keptCard(1, { flags: [{ kind: 'unfilledGap', words: [] }] });
    expect(labelSuggestionState(held)).toBe('kept · needs its number');
    expect(labelSuggestionState(keptCard(1, { review: { userText: 'Ran it' } }))).toBe(
      'kept · edited'
    );
  });

  it('says only dropped for a dropped card, whatever was kept', () => {
    expect(labelSuggestionState({ ...keptCard(3), status: 'rejected' })).toBe('dropped');
  });
});

describe('labelLateAddition', () => {
  it('reads "just added" in a first version, and names a later one', () => {
    const card = keptCard(3);
    expect(labelLateAddition(card, card.versions[0])).toBe('just added');
    expect(labelLateAddition(card, card.versions[2])).toBe('new in version 3');
  });
});
