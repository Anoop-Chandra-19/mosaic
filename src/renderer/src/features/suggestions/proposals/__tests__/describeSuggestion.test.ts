import { describe, expect, it } from 'vitest';
import type { ProposalChange } from '@/types/agentProposal';
import { describeLandedSuggestions, placeSuggestion } from '../describeSuggestion';
import {
  addText,
  makeProposal,
  makeResume,
  makeResumeWithLines,
  rewrite,
} from './proposalFixtures';

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
  place: { unit: 'bullet', sectionId: 's1', entryId: 'e2', bulletId: 'b4' },
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
    expect(placeSuggestion(doc, ENTRY)).toEqual(['Experience', 'after Lantern Maps']);
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

describe('added text and lines', () => {
  const lines = makeResumeWithLines();
  const summaryLine = {
    kind: 'rewrite' as const,
    place: { unit: 'line' as const, sectionId: 's2', lineId: 'l1' },
    before: 'Backend engineer for six years.',
    after: 'Backend engineer for six years, mostly payments.',
  };

  it('names new text by where it goes, and a line by its place in the section', () => {
    expect(placeSuggestion(lines, addText('bullet', 'b2', 'x'))).toEqual([
      'Experience',
      'Harbor Freight Labs',
      'after bullet 2',
    ]);
    expect(placeSuggestion(lines, addText('line', null, 'x'))).toEqual(['Skills', 'first']);
    expect(placeSuggestion(lines, summaryLine)).toEqual(['Summary', 'line 1']);
  });

  it('titles a version by the section when a line, not an entry, landed', () => {
    expect(describeLandedSuggestions(lines, [makeProposal(summaryLine, 'p1')])).toBe(
      'Rewrite in Summary, line 1'
    );
  });

  it('says what new text is once, in the title', () => {
    expect(
      describeLandedSuggestions(lines, [makeProposal(addText('bullet', 'b2', 'x'), 'p1')])
    ).toBe('New bullet in Harbor Freight Labs, after bullet 2');
    expect(describeLandedSuggestions(lines, [makeProposal(addText('line', null, 'x'), 'p1')])).toBe(
      'New line in Skills, first'
    );
  });
});

describe('whole entries, sections and their order', () => {
  it('names an entry by where it was, a section by its label, and the order as such', () => {
    const lines = makeResumeWithLines();
    const select = (
      place: Extract<ProposalChange, { kind: 'select' }>['place']
    ): ProposalChange => ({
      kind: 'select',
      place,
      before: '',
      selected: false,
    });
    expect(
      placeSuggestion(lines, select({ unit: 'entry', sectionId: 's1', entryId: 'e2' }))
    ).toEqual(['Experience', 'Lantern Maps']);
    expect(placeSuggestion(lines, select({ unit: 'section', sectionId: 's3' }))).toEqual([
      'Skills',
    ]);
    expect(
      placeSuggestion(lines, {
        kind: 'reorder',
        place: { unit: 'sections' },
        before: [],
        after: [],
      })
    ).toEqual(['Section order']);
  });
});

describe('new sections and headings', () => {
  it('names a new section by its heading, and a rename by its section', () => {
    const talks: ProposalChange = {
      kind: 'section',
      afterSectionId: null,
      section: { kind: 'custom', layout: 'lines', label: 'Talks' },
      contents: { layout: 'lines', lines: ['A talk'] },
    };
    expect(placeSuggestion(makeResume(), talks)).toEqual(['Talks']);
    expect(describeLandedSuggestions(makeResume(), [makeProposal(talks, 'p1')])).toBe(
      'New section, Talks'
    );
    expect(
      placeSuggestion(makeResume(), { kind: 'rename', sectionId: 's1', before: '', after: '' })
    ).toEqual(['Experience', 'heading']);
  });
});
