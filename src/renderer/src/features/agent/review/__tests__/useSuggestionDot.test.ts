import { describe, expect, it } from 'vitest';
import type { Proposal, ProposalChange, ProposalStatus } from '@shared/types/agentProposal';
import { addText, makeProposal, rewrite } from '../../proposals/__tests__/proposalFixtures';
import { findSuggestionDot } from '../useSuggestionDot';

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

describe('findSuggestionDot', () => {
  it('points a bullet to the suggestion waiting on it, and a merge to both its bullets', () => {
    const proposals = [proposal('merge', merge)];
    expect(findSuggestionDot(proposals, 'b1')).toMatchObject({
      proposalId: 'merge',
      isStale: false,
    });
    expect(findSuggestionDot(proposals, 'b2')).toMatchObject({
      proposalId: 'merge',
      isStale: false,
    });
    expect(findSuggestionDot(proposals, 'b3')).toBeNull();
  });

  it('skips what was applied or dropped', () => {
    const proposals = [
      proposal('done', rewrite('b1', B1, 'Led it'), 'applied'),
      proposal('dropped', rewrite('b1', B1, 'Ran it'), 'rejected'),
    ];
    expect(findSuggestionDot(proposals, 'b1')).toBeNull();
  });

  it('is out of date only when every suggestion on the bullet is', () => {
    const stale = proposal('stale', rewrite('b1', B1, 'Led it'), 'accepted', true);
    expect(findSuggestionDot([stale], 'b1')).toMatchObject({ proposalId: 'stale', isStale: true });
    const current = proposal('current', rewrite('b1', B1, 'Ran it'));
    expect(findSuggestionDot([stale, current], 'b1')).toMatchObject({
      proposalId: 'current',
      isStale: false,
    });
  });
});

describe('findSuggestionDot, added text', () => {
  it("puts a new bullet's dot on its entry, saying so", () => {
    const proposals = [proposal('add', addText('bullet', 'b1', 'Ran the rotation'))];
    expect(findSuggestionDot(proposals, 'e1')).toEqual({
      proposalId: 'add',
      isStale: false,
      waiting: 'A new bullet is suggested for this entry.',
    });
    expect(findSuggestionDot(proposals, 'b1')).toBeNull();
  });
});

describe('findSuggestionDot, whole entries and sections', () => {
  it('says what waits on an entry or a section, and marks only the sections that move', () => {
    const proposals = [
      proposal('leave', {
        kind: 'select',
        place: { unit: 'entry', sectionId: 's1', entryId: 'e2' },
        before: 'Intern, Lantern Maps',
        selected: false,
      }),
      proposal('order', {
        kind: 'reorder',
        place: { unit: 'sections' },
        before: ['s1', 's2', 's3'],
        after: ['s1', 's3', 's2'],
      }),
    ];
    expect(findSuggestionDot(proposals, 'e2')?.waiting).toBe(
      'A suggestion to leave this entry off the page is waiting.'
    );
    expect(findSuggestionDot(proposals, 's3')?.waiting).toBe('A suggestion moves this section.');
    expect(findSuggestionDot(proposals, 's1')).toBeNull();
  });
});
