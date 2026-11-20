import { describe, expect, it } from 'vitest';
import type { ProposalChange, ProposalReview } from '@/types/agentProposal';
import {
  findUnconfirmedFacts,
  listNewEntries,
  resolveChange,
  resolveNewContentIds,
  reviewedRequestText,
} from '../reviewedChange';
import { readActiveVersion } from '../proposalVersions';
import { addText, makeProposal, rewrite } from './proposalFixtures';

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

/** The version of a suggestion for this change, with the user's review of it. */
const reviewed = (change: ProposalChange, review: ProposalReview) =>
  readActiveVersion(makeProposal(change, 'p1', { review }));
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
    // A new entry's id is the first id the fixture makes for it.
    const factEdits = { 'p1-new1': { dates: '2022 – Present' } };
    const change = resolveChange(reviewed(ENTRY, { factEdits }));
    expect(change).toMatchObject({ frame: { title: 'Volunteer Mentor', dates: '2022 – Present' } });
  });
});

describe('findUnconfirmedFacts', () => {
  it('lists the facts with text the user hasn’t vouched for', () => {
    const confirmedFacts = { 'p1-new1': ['title' as const] };
    expect(findUnconfirmedFacts(reviewed(ENTRY, { confirmedFacts }))).toEqual([
      { entryId: 'p1-new1', fact: 'organization' },
      { entryId: 'p1-new1', fact: 'dates' },
    ]);
    expect(findUnconfirmedFacts(reviewed(GAPPED, {}))).toEqual([]);
  });
});

describe('reviewedRequestText', () => {
  it('counts the user’s own words and number as known', () => {
    const version = { ...reviewed(GAPPED, { filledNumber: '30' }), requestText: 'Tighten it' };
    expect(reviewedRequestText(version)).toBe('Tighten it\n30');
  });
});

describe('resolveChange, added text', () => {
  it("takes the user's wording, and the place they chose when its own was gone", () => {
    const version = reviewed(addText('bullet', 'b9', 'Ran the rotation'), {
      userText: 'Ran the on-call rotation',
      placedAfterId: 'b3',
    });
    expect(resolveChange(version)).toMatchObject({
      afterId: 'b3',
      text: 'Ran the on-call rotation',
    });
  });

  it('fills the gap, or takes the version without a number, as a rewrite does', () => {
    const gapped: ProposalChange = {
      ...addText('bullet', 'b3', 'Cut build time by {{?}}%'),
      gap: { withoutNumber: 'Cut build time' },
    };
    expect(resolveChange(reviewed(gapped, { filledNumber: '40' }))).toMatchObject({
      text: 'Cut build time by 40%',
      gap: undefined,
    });
    expect(resolveChange(reviewed(gapped, { isWithoutNumber: true }))).toMatchObject({
      text: 'Cut build time',
    });
  });
});

/*
 * A new section of two entries. The fixture's ids: the section is p1-new1, the first entry
 * p1-new2 with its bullet p1-new3, and the second entry p1-new4 with its bullet p1-new5.
 */
const CERTIFICATIONS: ProposalChange = {
  kind: 'section',
  afterSectionId: 's1',
  section: { kind: 'certifications', layout: 'entries', label: 'Certifications' },
  contents: {
    layout: 'entries',
    entries: [
      {
        frame: { title: 'Solutions Architect', organization: 'Amazon Web Services' },
        bullets: [' '],
      },
      {
        frame: { title: 'Kubernetes Administrator', organization: 'CNCF' },
        bullets: ['Passed on the first attempt'],
      },
    ],
  },
};

describe('resolveChange, a new section', () => {
  it('takes the heading the user gave, and their facts for each entry, which they confirm one by one', () => {
    const proposal = reviewed(CERTIFICATIONS, {
      sectionLabel: 'Certificates',
      factEdits: { 'p1-new2': { title: 'Solutions Architect, Associate' } },
      confirmedFacts: { 'p1-new2': ['title'], 'p1-new4': ['title', 'organization'] },
    });
    expect(resolveChange(proposal)).toMatchObject({
      section: { label: 'Certificates' },
      contents: {
        entries: [
          { frame: { title: 'Solutions Architect, Associate' } },
          { frame: { title: 'Kubernetes Administrator' } },
        ],
      },
    });
    expect(findUnconfirmedFacts(proposal)).toEqual([{ entryId: 'p1-new2', fact: 'organization' }]);
  });

  it('leaves out the entries the user left out, with their ids, and their facts need nothing', () => {
    const proposal = reviewed(CERTIFICATIONS, { leftOutEntryIds: ['p1-new2'] });
    const change = resolveChange(proposal);
    expect(change.kind === 'section' && change.contents).toEqual({
      layout: 'entries',
      entries: [
        {
          frame: { title: 'Kubernetes Administrator', organization: 'CNCF' },
          bullets: ['Passed on the first attempt'],
        },
      ],
    });
    expect(resolveNewContentIds(proposal)).toMatchObject({
      contents: { entries: [{ entryId: 'p1-new4', bulletIds: ['p1-new5'] }] },
    });
    expect(findUnconfirmedFacts(proposal).map((place) => place.entryId)).toEqual([
      'p1-new4',
      'p1-new4',
    ]);
  });

  it('lists every entry with its ids, the left-out ones marked', () => {
    const entries = listNewEntries(reviewed(CERTIFICATIONS, { leftOutEntryIds: ['p1-new4'] }));
    expect(entries.map(({ ids, isLeftOut }) => [ids.entryId, isLeftOut])).toEqual([
      ['p1-new2', false],
      ['p1-new4', true],
    ]);
  });
});
