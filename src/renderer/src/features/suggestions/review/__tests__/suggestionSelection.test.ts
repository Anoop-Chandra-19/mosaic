import { describe, expect, it } from 'vitest';
import type { ProposalChange, ProposalReview } from '@/types/agentProposal';
import { makeProposal } from '../../proposals/__tests__/proposalFixtures';
import { findNextEntryToOpen, readOpenEntryId } from '../suggestionSelection';

/*
 * A new section of three entries, each with only a title to confirm. The fixture's ids:
 * the section is v-new1, and the entries are v-new2, v-new3 and v-new4.
 */
const VOLUNTEERING: ProposalChange = {
  kind: 'section',
  afterSectionId: 's1',
  section: { kind: 'volunteering', layout: 'entries', label: 'Volunteering' },
  contents: {
    layout: 'entries',
    entries: [
      { frame: { title: 'Mentor' }, bullets: [] },
      { frame: { title: 'Organizer' }, bullets: [] },
      { frame: { title: 'Workshop Lead' }, bullets: [] },
    ],
  },
};

const volunteering = (review: ProposalReview) => ({
  ...makeProposal(VOLUNTEERING, 'v'),
  review,
});

describe('readOpenEntryId', () => {
  it('opens the first entry with facts to confirm until the user opens one', () => {
    const proposal = volunteering({ confirmedFacts: { 'v-new2': ['title'] } });
    expect(readOpenEntryId(proposal, {})).toBe('v-new3');
    expect(readOpenEntryId(proposal, { v: 'v-new4' })).toBe('v-new4');
    expect(readOpenEntryId(proposal, { v: null })).toBeNull();
  });

  it('opens nothing once every fact is confirmed, or when the opened entry was left out', () => {
    const confirmedFacts = {
      'v-new2': ['title' as const],
      'v-new3': ['title' as const],
      'v-new4': ['title' as const],
    };
    expect(readOpenEntryId(volunteering({ confirmedFacts }), {})).toBeNull();
    const leftOut = volunteering({ leftOutEntryIds: ['v-new3'] });
    expect(readOpenEntryId(leftOut, { v: 'v-new3' })).toBeNull();
  });
});

describe('findNextEntryToOpen', () => {
  it('goes on to the next entry with facts left, round to the start', () => {
    const proposal = volunteering({ confirmedFacts: { 'v-new3': ['title'] } });
    expect(findNextEntryToOpen(proposal, 'v-new2')).toBe('v-new4');
    expect(findNextEntryToOpen(proposal, 'v-new4')).toBe('v-new2');
  });

  it('skips left-out entries, and opens nothing when no other entry needs the user', () => {
    const proposal = volunteering({
      confirmedFacts: { 'v-new4': ['title'] },
      leftOutEntryIds: ['v-new3'],
    });
    expect(findNextEntryToOpen(proposal, 'v-new4')).toBe('v-new2');
    expect(findNextEntryToOpen(proposal, 'v-new2')).toBeNull();
  });
});
