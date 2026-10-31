import { describe, expect, it } from 'vitest';
import type { Proposal, ProposalStatus } from '@/types/agentProposal';
import { makeProposal, rewrite } from '../../../proposals/__tests__/proposalFixtures';
import { describeMarkTip } from '../describeMarkTip';

const BEFORE = 'Assisted in migrating billing to Postgres';
const AFTER = 'Led the migration of billing to MySQL';

const rewriteMark = (status: ProposalStatus = 'pending', isStale = false) => {
  const proposal: Proposal = {
    ...makeProposal(rewrite('b1', BEFORE, AFTER), 'led'),
    status,
    isStale,
  };
  return { proposal, look: 'edit' as const, words: { before: BEFORE, after: AFTER } };
};

describe('describeMarkTip', () => {
  it('says where a rewrite stands, its first change, and how many more', () => {
    const tip = describeMarkTip(rewriteMark());
    expect(tip).toMatch(/^.+, waiting\. “.+” becomes “.+”, and \d+ more changes?\.$/);
  });

  it('says only where it stands once your words print', () => {
    expect(describeMarkTip(rewriteMark('rejected'))).toMatch(/, dropped, so your words print\.$/);
    expect(describeMarkTip(rewriteMark('pending', true))).toMatch(
      /, out of date: you changed this after it was suggested\.$/
    );
  });

  it('names what to check, a move’s places, and an entry put back', () => {
    const { proposal } = rewriteMark();
    const flagged = { ...proposal, flags: [proposal.flags[0], proposal.flags[0]] };
    expect(describeMarkTip({ proposal: flagged, look: 'add' })).toMatch(/2 things to check\.$/);
    expect(describeMarkTip(undefined, { proposal, from: 2, to: 1 })).toMatch(
      /Moved from 2 to 1\.$/
    );
    expect(describeMarkTip({ proposal, look: 'add', block: 'back' })).toMatch(
      /Back on the page, as you left it\.$/
    );
  });
});
