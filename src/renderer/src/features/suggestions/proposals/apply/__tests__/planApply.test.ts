import { describe, expect, it } from 'vitest';
import type { Proposal, ProposalChange, ProposalStatus } from '@shared/types/agentProposal';
import { planApply } from '../planApply';
import { makeProposal, makeResume, rewrite } from '../../__tests__/proposalFixtures';

const B1 = 'Assisted in migrating billing to Postgres';
const B2 = 'Reduced p99 latency from 18% to 3% of requests';

function proposal(
  id: string,
  change: ProposalChange,
  status: ProposalStatus,
  more: Partial<Proposal> = {}
): Proposal {
  return { ...makeProposal(change, id), status, ...more };
}

const ids = (list: readonly Proposal[]) => list.map((p) => p.id);

describe('planApply', () => {
  it('sorts every open suggestion into what lands, waits, is stale or was dropped', () => {
    const plan = planApply(makeResume(), [
      proposal('kept', rewrite('b1', B1, 'Led the billing migration to Postgres'), 'accepted'),
      proposal('waiting', rewrite('b2', B2, 'Cut p99 latency'), 'pending'),
      proposal('stale', rewrite('b2', B2, 'Cut latency'), 'accepted', { isStale: true }),
      proposal('dropped', rewrite('b2', B2, 'Cut it'), 'rejected'),
      proposal('done', rewrite('b2', B2, 'Old news'), 'applied'),
    ]);

    expect(ids(plan.landed)).toEqual(['kept']);
    expect(ids(plan.waiting)).toEqual(['waiting']);
    expect(ids(plan.stale)).toEqual(['stale']);
    expect(ids(plan.dropped)).toEqual(['dropped']);
    expect(plan.doc.sections[0].items[0].bullets[0].text).toBe(
      'Led the billing migration to Postgres'
    );
  });

  it('holds back a kept one with a number to fill, and lands it once filled', () => {
    const gapped = proposal('gap', rewrite('b2', B2, 'Cut slow requests by {{?}}%'), 'accepted', {
      flags: [{ kind: 'unfilledGap', words: ['{{?}}'] }],
    });

    expect(ids(planApply(makeResume(), [gapped]).held)).toEqual(['gap']);
    const filled = { ...gapped, flags: [], review: { filledNumber: '83' } };
    const plan = planApply(makeResume(), [filled]);
    expect(ids(plan.landed)).toEqual(['gap']);
    expect(plan.doc.sections[0].items[0].bullets[1].text).toBe('Cut slow requests by 83%');
  });

  it('skips a second change to the same bullet, naming the one that changed it first', () => {
    const first = proposal('first', rewrite('b2', B2, 'Cut p99 latency'), 'accepted');
    const second = proposal('second', rewrite('b2', B2, 'Cut slow requests'), 'accepted');

    const plan = planApply(makeResume(), [first, second]);

    expect(ids(plan.landed)).toEqual(['first']);
    expect(plan.skipped).toEqual([{ proposal: second, changedBy: first }]);
  });
});
