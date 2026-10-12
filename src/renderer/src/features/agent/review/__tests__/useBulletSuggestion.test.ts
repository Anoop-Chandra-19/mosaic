import { describe, expect, it } from 'vitest';
import type { Proposal, ProposalChange, ProposalStatus } from '@shared/types/agentProposal';
import { makeProposal, rewrite } from '../../proposals/__tests__/proposalFixtures';
import { findBulletSuggestion } from '../useBulletSuggestion';

const B1 = 'Assisted in migrating billing to Postgres';
const B2 = 'Reduced p99 latency from 18% to 3% of requests';

const proposal = (
  id: string,
  change: ProposalChange,
  status: ProposalStatus = 'pending',
  isStale = false
): Proposal => ({ ...makeProposal(change, id), status, isStale });

const merge: ProposalChange = {
  kind: 'merge',
  sectionId: 's1',
  entryId: 'e1',
  firstId: 'b1',
  secondId: 'b2',
  before: [B1, B2],
  after: 'Moved billing to Postgres, cutting p99 latency',
};

describe('findBulletSuggestion', () => {
  it('points a bullet to the suggestion waiting on it, and a merge to both its bullets', () => {
    const proposals = [proposal('merge', merge)];
    expect(findBulletSuggestion(proposals, 'b1')).toEqual({ proposalId: 'merge', isStale: false });
    expect(findBulletSuggestion(proposals, 'b2')).toEqual({ proposalId: 'merge', isStale: false });
    expect(findBulletSuggestion(proposals, 'b3')).toBeNull();
  });

  it('skips what was applied or dropped', () => {
    const proposals = [
      proposal('done', rewrite('b1', B1, 'Led it'), 'applied'),
      proposal('dropped', rewrite('b1', B1, 'Ran it'), 'rejected'),
    ];
    expect(findBulletSuggestion(proposals, 'b1')).toBeNull();
  });

  it('is out of date only when every suggestion on the bullet is', () => {
    const stale = proposal('stale', rewrite('b1', B1, 'Led it'), 'accepted', true);
    expect(findBulletSuggestion([stale], 'b1')).toEqual({ proposalId: 'stale', isStale: true });
    const current = proposal('current', rewrite('b1', B1, 'Ran it'));
    expect(findBulletSuggestion([stale, current], 'b1')).toEqual({
      proposalId: 'current',
      isStale: false,
    });
  });
});
