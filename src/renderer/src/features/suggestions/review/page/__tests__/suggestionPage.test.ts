import { describe, expect, it } from 'vitest';
import type { Proposal, ProposalChange, ProposalStatus } from '@/types/agentProposal';
import {
  addText,
  makeProposal,
  makeResume,
  rewrite,
} from '../../../proposals/__tests__/proposalFixtures';
import { buildSuggestionPage } from '../suggestionPage';

const B1 = 'Assisted in migrating billing to Postgres';
const B2 = 'Reduced p99 latency from 18% to 3% of requests';

const proposal = (id: string, change: ProposalChange, status: ProposalStatus = 'pending') => ({
  ...makeProposal(change, id),
  status,
});
const textOf = (doc: ReturnType<typeof makeResume>, entryIndex = 0) =>
  doc.sections[0].items[entryIndex].bullets.map((b) => b.text);

describe('buildSuggestionPage', () => {
  it('lays waiting and kept suggestions in, marked, and leaves dropped ones as the draft has them', () => {
    const draft = makeResume();
    const page = buildSuggestionPage(draft, [
      proposal('led', rewrite('b1', B1, 'Led the billing migration to Postgres')),
      proposal('cut', rewrite('b2', B2, 'Cut p99 latency'), 'rejected'),
    ]);

    expect(textOf(page.doc).slice(0, 2)).toEqual(['Led the billing migration to Postgres', B2]);
    expect(page.marks.get('b1')?.proposal.id).toBe('led');
    expect(page.marks.get('b2')?.proposal.id).toBe('cut');
    expect(textOf(draft)[0]).toBe(B1);
  });

  it('marks both halves of a split, and keeps a hidden bullet on the page, struck', () => {
    const split: ProposalChange = {
      kind: 'split',
      sectionId: 's1',
      entryId: 'e1',
      bulletId: 'b1',
      before: B1,
      at: B1.indexOf('to Postgres'),
    };
    const hide: ProposalChange = {
      kind: 'select',
      place: { unit: 'bullet', sectionId: 's1', entryId: 'e1', bulletId: 'b2' },
      before: B2,
      selected: false,
    };
    const page = buildSuggestionPage(makeResume(), [
      proposal('split', split),
      proposal('hide', hide),
    ]);

    const [first, second] = page.doc.sections[0].items[0].bullets;
    expect([first.text, second.text]).toEqual(['Assisted in migrating billing', 'to Postgres']);
    expect(page.marks.get(second.id)?.proposal.id).toBe('split');
    expect(page.marks.get('b2')).toMatchObject({ look: 'hide' });
    expect(page.doc.sections[0].items[0].bullets.find((b) => b.id === 'b2')?.selected).toBe(true);
  });

  it('shows the first of two rewrites of one bullet, and chips the bullets a reorder moves', () => {
    const reorder: ProposalChange = {
      kind: 'reorder',
      place: { unit: 'bullets', sectionId: 's1', entryId: 'e1' },
      before: ['b1', 'b2', 'b3'],
      after: ['b2', 'b1', 'b3'],
    };
    const page = buildSuggestionPage(makeResume(), [
      proposal('first', rewrite('b2', B2, 'Cut p99 latency')),
      proposal('second', rewrite('b2', B2, 'Cut slow requests')),
      proposal('order', reorder),
    ]);

    expect(page.marks.get('b2')?.proposal.id).toBe('first');
    expect(textOf(page.doc)[0]).toBe('Cut p99 latency');
    expect(page.moves.get('b2')).toMatchObject({ from: 2, to: 1 });
    expect(page.moves.has('b3')).toBe(false);
  });

  it('marks a new entry’s heading and bullets as added', () => {
    const entry: ProposalChange = {
      kind: 'entry',
      sectionId: 's1',
      afterEntryId: 'e2',
      frame: { title: 'Mentor' },
      bullets: ['Mentored new engineers'],
    };
    const page = buildSuggestionPage(makeResume(), [proposal('new', entry)] as Proposal[]);

    const added = page.doc.sections[0].items[2];
    expect(page.marks.get(added.id)).toMatchObject({ look: 'add' });
    expect(page.marks.get(added.bullets[0].id)).toMatchObject({ look: 'add' });
  });
});

describe('buildSuggestionPage, added text', () => {
  it('lays a new bullet in at its place, marked as added', () => {
    const page = buildSuggestionPage(makeResume(), [
      proposal('add', addText('bullet', 'b1', 'Ran the on-call rotation')),
    ]);
    const bullets = page.doc.sections[0].items[0].bullets;
    expect(bullets.map((b) => b.text)[1]).toBe('Ran the on-call rotation');
    expect(page.marks.get(bullets[1].id)).toMatchObject({ look: 'add' });
  });
});

describe('buildSuggestionPage, whole entries and sections', () => {
  it('keeps an entry leaving on the page as a block, and lays one coming back in', () => {
    const doc = makeResume();
    doc.sections[0].items[1].selected = false;
    const page = buildSuggestionPage(doc, [
      proposal('leave', {
        kind: 'select',
        place: { unit: 'entry', sectionId: 's1', entryId: 'e1' },
        before: 'Backend Engineer, Harbor Freight Labs',
        selected: false,
      }),
      proposal('back', {
        kind: 'select',
        place: { unit: 'entry', sectionId: 's1', entryId: 'e2' },
        before: 'Intern, Lantern Maps',
        selected: true,
      }),
    ]);
    expect(page.doc.sections[0].items.map((entry) => entry.selected)).toEqual([true, true]);
    expect(page.marks.get('e1')).toMatchObject({ look: 'hide', block: 'leaving' });
    expect(page.marks.get('e2')).toMatchObject({ look: 'add', block: 'back' });
  });
});

describe('buildSuggestionPage, new sections and headings', () => {
  it('lays a new section in marked as added, and marks a renamed heading', () => {
    const page = buildSuggestionPage(makeResume(), [
      proposal('talks', {
        kind: 'section',
        afterSectionId: 's1',
        section: { kind: 'custom', layout: 'lines', label: 'Talks' },
        contents: { layout: 'lines', lines: ['A talk'] },
      }),
      proposal('rename', { kind: 'rename', sectionId: 's1', before: 'Experience', after: 'Work' }),
    ]);
    const talks = page.doc.sections.find((section) => section.label === 'Talks')!;
    expect(page.marks.get(talks.id)).toMatchObject({ look: 'add' });
    expect(page.marks.get(talks.items[0].id)).toMatchObject({ look: 'add' });
    expect(page.doc.sections[0].label).toBe('Work');
    expect(page.marks.get('s1')).toMatchObject({ look: 'edit' });
  });
});
