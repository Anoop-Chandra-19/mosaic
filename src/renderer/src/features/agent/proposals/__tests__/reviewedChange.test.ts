import { describe, expect, it } from 'vitest';
import type { ProposalChange, ProposalReview } from '@shared/types/agentProposal';
import { findUnconfirmedFacts, resolveChange, reviewedRequestText } from '../reviewedChange';
import { makeProposal, rewrite } from './proposalFixtures';

const B3 = 'Wrote the on-call runbook for the payments team';
const GAPPED: ProposalChange = {
  ...rewrite('b3', B3, 'Wrote the on-call runbook that cut pages by {{?}}%'),
  gap: { withoutNumber: 'Wrote the on-call runbook that cut pages for payments' },
};
const ENTRY: ProposalChange = {
  kind: 'entry',
  sectionId: 's1',
  frame: { title: 'Volunteer Mentor', organization: 'Code for Portland', dates: '2021' },
  bullets: ['Mentor first-time contributors'],
};

const reviewed = (change: ProposalChange, review: ProposalReview) => ({
  ...makeProposal(change, 'p1'),
  review,
});
const afterOf = (change: ProposalChange) => (change.kind === 'rewrite' ? change.after : null);

describe('resolveChange', () => {
  it('writes the assistant’s text until the user says otherwise', () => {
    expect(resolveChange(reviewed(GAPPED, {}))).toEqual(GAPPED);
  });

  it('fills the gap, then takes the version without a number, then the user’s words over both', () => {
    expect(afterOf(resolveChange(reviewed(GAPPED, { filledNumber: '30' })))).toBe(
      'Wrote the on-call runbook that cut pages by 30%'
    );
    expect(afterOf(resolveChange(reviewed(GAPPED, { isWithoutNumber: true })))).toBe(
      'Wrote the on-call runbook that cut pages for payments'
    );
    expect(
      afterOf(
        resolveChange(reviewed(GAPPED, { filledNumber: '30', userText: 'Wrote the runbook' }))
      )
    ).toBe('Wrote the runbook');
  });

  it('drops the gap once nothing is left to fill', () => {
    expect(resolveChange(reviewed(GAPPED, { filledNumber: '30' }))).not.toHaveProperty(
      'gap.withoutNumber'
    );
  });

  it('replaces the bullet as it is now, once the user reviews a stale one anyway', () => {
    const change = resolveChange(reviewed(GAPPED, { rebasedBefore: 'Wrote the payments runbook' }));
    expect(change).toMatchObject({ before: 'Wrote the payments runbook' });
  });

  it('takes the user’s corrections to a new entry’s facts', () => {
    const change = resolveChange(reviewed(ENTRY, { factEdits: { dates: '2022 – Present' } }));
    expect(change).toMatchObject({ frame: { title: 'Volunteer Mentor', dates: '2022 – Present' } });
  });
});

describe('findUnconfirmedFacts', () => {
  it('lists the facts with text the user hasn’t vouched for', () => {
    expect(findUnconfirmedFacts(reviewed(ENTRY, { confirmedFacts: ['title'] }))).toEqual([
      'organization',
      'dates',
    ]);
    expect(findUnconfirmedFacts(reviewed(GAPPED, {}))).toEqual([]);
  });
});

describe('reviewedRequestText', () => {
  it('counts the user’s own words and number as known', () => {
    const proposal = { ...reviewed(GAPPED, { filledNumber: '30' }), requestText: 'Tighten it' };
    expect(reviewedRequestText(proposal)).toBe('Tighten it\n30');
  });
});
