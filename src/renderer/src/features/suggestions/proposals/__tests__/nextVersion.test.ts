import { describe, expect, it } from 'vitest';
import type { Proposal, ProposalChange, ProposalReview } from '@/types/agentProposal';
import { buildNextVersion, findVersionToChange } from '../nextVersion';
import { makeProposal, rewrite } from './proposalFixtures';

const B1 = 'Assisted in migrating billing to Postgres';
const LED = 'Led the billing migration to Postgres';

/** A rewrite of b1, kept, in the state given. */
const rewriteCard = (overrides: Partial<Proposal> = {}, review: ProposalReview = {}): Proposal => ({
  ...makeProposal(rewrite('b1', B1, LED), 'p1', { review }),
  ...overrides,
});

/** The same card with a second version, `p1-v2`, waiting behind the kept `p1-v1`. */
function withWaitingVersion(review: ProposalReview = {}): Proposal {
  const card = rewriteCard();
  const second = { ...card.versions[0], id: 'p1-v2', review };
  return { ...card, versions: [...card.versions, second] };
}

describe('findVersionToChange', () => {
  it('changes the newest version in place while nothing is kept', () => {
    const waiting = rewriteCard({ status: 'pending', keptVersionId: null });
    expect(findVersionToChange(waiting, 'b1')).toMatchObject({
      kind: 'inPlace',
      version: { id: 'p1-v1' },
    });
  });

  it('is a suggestion of its own when nothing is kept and the text is the user’s wording', () => {
    const waiting = rewriteCard({ status: 'pending', keptVersionId: null }, { userText: 'Ran it' });
    expect(findVersionToChange(waiting, 'b1')).toBeNull();
  });

  it('builds a new version on the kept one when it is the newest', () => {
    expect(findVersionToChange(rewriteCard(), 'b1')).toMatchObject({
      kind: 'newVersion',
      base: { id: 'p1-v1' },
    });
  });

  it('changes the version waiting behind the kept one in place', () => {
    expect(findVersionToChange(withWaitingVersion(), 'b1')).toMatchObject({
      kind: 'inPlace',
      version: { id: 'p1-v2' },
    });
  });

  it('builds on the waiting version when that text is in the user’s words there', () => {
    expect(findVersionToChange(withWaitingVersion({ filledNumber: '40' }), 'b1')).toMatchObject({
      kind: 'newVersion',
      base: { id: 'p1-v2' },
    });
  });

  it('is a suggestion of its own when the card is dropped, applied or out of date', () => {
    expect(findVersionToChange(rewriteCard({ status: 'rejected' }))).toBeNull();
    expect(findVersionToChange(rewriteCard({ status: 'applied' }))).toBeNull();
    expect(findVersionToChange(rewriteCard({ isStale: true }))).toBeNull();
  });
});

const VOLUNTEERING: ProposalChange = {
  kind: 'section',
  afterSectionId: 's1',
  section: { kind: 'volunteering', layout: 'entries', label: 'Volunteering' },
  contents: {
    layout: 'entries',
    entries: [
      { frame: { title: 'Mentor' }, bullets: ['Mentored new contributors'] },
      { frame: { title: 'Organizer' }, bullets: ['Ran the meetups'] },
    ],
  },
};

describe('buildNextVersion', () => {
  it('carries what the user confirmed, corrected and left out, with a new id and no labels', () => {
    const review: ProposalReview = {
      confirmedFacts: { 'v-new2': ['title'] },
      factEdits: { 'v-new2': { title: 'Volunteer Mentor' } },
      leftOutEntryIds: ['v-new4'],
      sectionLabel: 'Giving back',
      filledNumbers: { 'v-new3': '12' },
    };
    const [base] = makeProposal(VOLUNTEERING, 'v', {
      review,
      lateIds: ['v-new4'],
      reason: 'You asked for it.',
    }).versions;

    const next = buildNextVersion(base);

    expect(next.id).not.toBe(base.id);
    expect(next.review).toEqual(review);
    expect(next.lateIds).toBeUndefined();
    expect(next.reason).toBeUndefined();
    expect(next.change).toBe(base.change);
  });

  it('drops the user’s wording of the text the change rewrites, and keeps their numbers as request', () => {
    const [base] = rewriteCard({}, { userText: 'Moved billing for 40 customers' }).versions;
    const next = buildNextVersion(base, 'b1');
    expect(next.review).toEqual({});
    expect(next.requestText).toContain('Moved billing for 40 customers');
  });

  it('drops only what the user did to the bullet or heading the change rewrites', () => {
    const [base] = makeProposal(VOLUNTEERING, 'v', {
      review: {
        sectionLabel: 'Giving back',
        filledNumbers: { 'v-new3': '12', 'v-new5': '3' },
        withoutNumberIds: ['v-new3'],
      },
    }).versions;

    expect(buildNextVersion(base, 'v-new3').review).toEqual({
      sectionLabel: 'Giving back',
      filledNumbers: { 'v-new5': '3' },
      withoutNumberIds: [],
    });
    expect(buildNextVersion(base, 'v-new1').review.sectionLabel).toBeUndefined();
  });
});
