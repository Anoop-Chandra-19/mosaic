import { describe, expect, it } from 'vitest';
import type { ProposalChange } from '@shared/types/agentProposal';
import { describeLandedSuggestions, placeSuggestion } from '../describeSuggestion';
import { makeProposal, makeResume, rewrite } from './proposalFixtures';

const doc = makeResume();
const B3 = 'Wrote the on-call runbook for the payments team';
const MERGE: ProposalChange = {
  kind: 'merge',
  sectionId: 's1',
  entryId: 'e1',
  firstId: 'b2',
  secondId: 'b3',
  before: ['', ''],
  after: 'Merged',
};
const ENTRY: ProposalChange = {
  kind: 'entry',
  sectionId: 's1',
  afterEntryId: 'e2',
  frame: { title: 'Mentor' },
  bullets: [],
};
const OSLO: ProposalChange = {
  ...rewrite('b4', 'Built tile caching for the Oslo office', 'Built the Oslo tile cache'),
  entryId: 'e2',
};

describe('placeSuggestion', () => {
  it('names the section, the entry by where it was, and the bullets by number', () => {
    expect(placeSuggestion(doc, rewrite('b3', B3, 'Wrote the runbook'))).toEqual([
      'Experience',
      'Harbor Freight Labs',
      'bullet 3',
    ]);
    expect(placeSuggestion(doc, MERGE)).toEqual([
      'Experience',
      'Harbor Freight Labs',
      'bullets 2 and 3',
    ]);
    expect(placeSuggestion(doc, ENTRY)).toEqual(['Experience', 'new entry, after Lantern Maps']);
  });
});

describe('describeLandedSuggestions', () => {
  it('says what one suggestion did, and where', () => {
    const landed = [makeProposal(rewrite('b3', B3, 'Wrote the runbook'), 'p1')];
    expect(describeLandedSuggestions(doc, landed)).toBe('Rewrite in Harbor Freight Labs, bullet 3');
  });

  it('counts several by the entries they touched, and by places past two', () => {
    const two = [makeProposal(MERGE, 'p1'), makeProposal(OSLO, 'p2')];
    expect(describeLandedSuggestions(doc, two)).toBe(
      '2 suggestions in Harbor Freight Labs and Lantern Maps'
    );
    const three = [...two, makeProposal(ENTRY, 'p3')];
    expect(describeLandedSuggestions(doc, three)).toBe('3 suggestions in 3 places');
  });
});
