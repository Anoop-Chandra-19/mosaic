import { describe, expect, it } from 'vitest';
import type { ProposalChange } from '@shared/types/agentProposal';
import { checkProposal } from '../checkProposal';
import { addText, makeResume } from '../../__tests__/proposalFixtures';

describe('checkProposal, added text', () => {
  it('reads an added bullet against its entry: its own names are not new', () => {
    const doc = makeResume();
    const flags = (text: string) =>
      checkProposal(doc, addText('bullet', 'b3', text), 'Add my on-call work').map((f) => f.kind);
    expect(flags('Ran on-call for the Harbor Freight Labs payments team')).toEqual([]);
    expect(flags('Moved the billing workers onto Kubernetes')).toEqual(['newNames']);
  });
});

describe('checkProposal, new content', () => {
  const doc = makeResume();
  const kindsAndWords = (change: ProposalChange) =>
    checkProposal(doc, change, 'Add my talks').map(({ kind, words }) => ({ kind, words }));

  it("checks a new section's lines, which have no facts to confirm", () => {
    const talks: ProposalChange = {
      kind: 'section',
      afterSectionId: null,
      section: { kind: 'custom', layout: 'lines', label: 'Talks' },
      contents: { layout: 'lines', lines: ['Postgres at scale, PDX Backend Meetup, 2024'] },
    };
    expect(kindsAndWords(talks)).toEqual([
      { kind: 'newNumbers', words: ['2024'] },
      { kind: 'newNames', words: ['PDX', 'Backend', 'Meetup'] },
    ]);
  });

  it("checks a new entry's bullets, beside the facts the user confirms", () => {
    const mentor: ProposalChange = {
      kind: 'entry',
      sectionId: 's1',
      frame: { title: 'Mentor' },
      bullets: ['Mentored 12 engineers'],
    };
    expect(kindsAndWords(mentor)).toEqual([{ kind: 'newNumbers', words: ['12'] }]);
  });

  it("reads a new entry's bullets against its own facts: they are not new there", () => {
    const frame = { title: 'Volunteer Mentor', organization: 'Code for Portland', dates: '2021' };
    const bullets = ['Mentored contributors at Code for Portland since 2021'];
    expect(kindsAndWords({ kind: 'entry', sectionId: 's1', frame, bullets })).toEqual([]);
    const volunteering: ProposalChange = {
      kind: 'section',
      afterSectionId: null,
      section: { kind: 'volunteering', layout: 'entries', label: 'Volunteering' },
      contents: { layout: 'entries', entry: { frame, bullets } },
    };
    expect(kindsAndWords(volunteering)).toEqual([]);
  });
});
