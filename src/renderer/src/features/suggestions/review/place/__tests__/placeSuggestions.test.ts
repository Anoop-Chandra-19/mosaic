import { describe, expect, it } from 'vitest';
import type { Proposal, ProposalChange, ProposalStatus } from '@/types/agentProposal';
import {
  addText,
  makeProposal,
  makeResumeWithLines,
  rewrite,
} from '../../../proposals/__tests__/proposalFixtures';
import { buildSuggestionPage } from '../../page/suggestionPage';
import {
  formatPlaceTally,
  groupSuggestionsByPlace,
  isPlaceFolded,
  listEasySuggestions,
  orderSuggestionsByPlace,
  tallyPlace,
} from '../placeSuggestions';

const proposal = (
  id: string,
  change: ProposalChange,
  status: ProposalStatus = 'pending'
): Proposal => ({ ...makeProposal(change, id), status });

const B1 = 'Assisted in migrating billing to Postgres';
const B4 = 'Built tile caching for the Oslo office';

const renameSkills: ProposalChange = {
  kind: 'rename',
  sectionId: 's3',
  before: 'Skills',
  after: 'Tools',
};
const reorderSections: ProposalChange = {
  kind: 'reorder',
  place: { unit: 'sections' },
  before: ['s1', 's2', 's3'],
  after: ['s2', 's1', 's3'],
};
const rewriteLantern: ProposalChange = {
  kind: 'rewrite',
  place: { unit: 'bullet', sectionId: 's1', entryId: 'e2', bulletId: 'b4' },
  before: B4,
  after: 'Built tile caching for three offices',
};
const newEntryAfterHarbor: ProposalChange = {
  kind: 'entry',
  sectionId: 's1',
  afterEntryId: 'e1',
  frame: { title: 'Contractor', organization: 'Quill Freight', location: '', dates: '2020' },
  bullets: ['Built the dispatch board'],
};
const newSectionAfterSummary: ProposalChange = {
  kind: 'section',
  afterSectionId: 's2',
  section: { kind: 'custom', layout: 'lines', label: 'Volunteering' },
  contents: { layout: 'lines', lines: ['Taught Go at a library meetup'] },
};

const keysOf = (places: ReturnType<typeof groupSuggestionsByPlace>) =>
  places.map((place) => place.key);

/** Group the suggestions against the page the review would show for them, as the review does. */
function groupOnPage(proposals: Proposal[], draft = makeResumeWithLines()) {
  const page = buildSuggestionPage(draft, proposals);
  return groupSuggestionsByPlace(draft, page.doc, proposals);
}

describe('groupSuggestionsByPlace', () => {
  it('puts the changes inside one entry on one card, named as the page names the entry', () => {
    const places = groupOnPage([
      proposal('p1', rewrite('b1', B1, 'Led the billing migration')),
      proposal('p2', addText('bullet', 'b3', 'Mentored two engineers')),
    ]);

    expect(places).toHaveLength(1);
    expect(places[0]).toMatchObject({
      kind: 'entry',
      title: 'Harbor Freight Labs',
      detail: 'Backend Engineer',
      sectionLabel: 'Experience',
    });
    expect(places[0].proposals.map((each) => each.id)).toEqual(['p1', 'p2']);
  });

  it('puts a heading and the lines of a lines section on the section card', () => {
    const places = groupOnPage([
      proposal('p1', addText('line', 'l2', 'Kubernetes')),
      proposal('p2', renameSkills),
    ]);

    expect(places).toHaveLength(1);
    expect(places[0]).toMatchObject({
      key: 'section:s3',
      title: 'Skills',
      detail: 'Section of lines',
    });
  });

  it('lists places in the order of the page with the suggestions laid in, the section order first', () => {
    // The reorder is made first: the page lays the suggestions in the order they were made.
    const places = groupOnPage([
      proposal('order', reorderSections),
      proposal('skills', renameSkills),
      proposal('section', newSectionAfterSummary),
      proposal('lantern', rewriteLantern),
      proposal('entry', newEntryAfterHarbor),
      proposal('harbor', rewrite('b1', B1, 'Led the billing migration')),
    ]);

    // The suggested order puts Summary first, and the new section goes after Summary.
    expect(keysOf(places)).toEqual([
      'order',
      'new:section',
      'entry:e1',
      'new:entry',
      'entry:e2',
      'section:s3',
    ]);
    expect(places[1]).toMatchObject({
      title: 'Volunteering',
      detail: 'New section, after Summary',
    });
    expect(places[3]).toMatchObject({ title: 'Quill Freight', detail: 'New entry in Experience' });
  });

  it('keeps the draft order when the reorder is dropped', () => {
    const places = groupOnPage([
      proposal('section', newSectionAfterSummary),
      proposal('harbor', rewrite('b1', B1, 'Led the billing migration')),
      proposal('order', reorderSections, 'rejected'),
    ]);

    expect(keysOf(places)).toEqual(['order', 'entry:e1', 'new:section']);
  });

  it('puts a dropped new entry or section where it would have gone', () => {
    const places = groupOnPage([
      proposal('skills', renameSkills),
      proposal('lantern', rewriteLantern),
      proposal('entry', newEntryAfterHarbor, 'rejected'),
      proposal('section', newSectionAfterSummary, 'rejected'),
    ]);

    expect(keysOf(places)).toEqual(['new:entry', 'entry:e2', 'new:section', 'section:s3']);
  });

  it('puts a section card before the cards of its entries', () => {
    const hideExperience: ProposalChange = {
      kind: 'select',
      place: { unit: 'section', sectionId: 's1' },
      before: 'Experience',
      selected: false,
    };
    const places = groupOnPage([
      proposal('harbor', rewrite('b1', B1, 'Led the billing migration')),
      proposal('hide', hideExperience),
    ]);

    expect(keysOf(places)).toEqual(['section:s1', 'entry:e1']);
  });

  it('shows the name the user gave a new section', () => {
    const renamed: Proposal = {
      ...makeProposal(newSectionAfterSummary, 'section', { review: { sectionLabel: 'Teaching' } }),
      status: 'pending',
    };

    expect(groupOnPage([renamed])[0].title).toBe('Teaching');
  });

  it('puts a suggestion whose entry is gone on its section, and one whose section is gone last', () => {
    const draft = makeResumeWithLines();
    draft.sections[0].items.splice(1, 1);
    const lostSection: ProposalChange = { ...renameSkills, sectionId: 'gone' };
    const places = groupOnPage(
      [
        { ...proposal('lost', lostSection), isStale: true },
        { ...proposal('lantern', rewriteLantern), isStale: true },
      ],
      draft
    );

    expect(keysOf(places)).toEqual(['section:s1', 'missing:lost']);
    expect(places[1]).toMatchObject({ title: 'Rename' });
  });

  it('orders every suggestion place by place', () => {
    const places = groupOnPage([
      proposal('lantern', rewriteLantern),
      proposal('harbor', rewrite('b1', B1, 'Led the billing migration')),
      proposal('harbor-2', addText('bullet', 'b3', 'Mentored two engineers')),
    ]);

    expect(orderSuggestionsByPlace(places).map((each) => each.id)).toEqual([
      'harbor',
      'harbor-2',
      'lantern',
    ]);
  });
});

describe('the place tally', () => {
  const flagged = (id: string): Proposal => ({
    ...makeProposal(rewrite('b1', B1, 'Led the billing migration of 40 services'), id, {
      flags: [{ kind: 'newNumbers', words: ['40'] }],
    }),
    status: 'pending',
  });

  it('counts each state, and the waiting ones that need a look', () => {
    const tally = tallyPlace([
      proposal('kept', rewrite('b1', B1, 'Led it'), 'accepted'),
      proposal('dropped', rewrite('b1', B1, 'Ran it'), 'rejected'),
      proposal('waiting', rewrite('b1', B1, 'Did it')),
      flagged('flagged'),
      { ...proposal('stale', rewrite('b1', B1, 'Owned it')), isStale: true },
    ]);

    expect(tally).toEqual({ kept: 1, dropped: 1, waiting: 2, stale: 1, toCheck: 1 });
    expect(formatPlaceTally(tally)).toBe('1 kept · 1 dropped · 2 waiting · 1 out of date');
  });

  it('offers to keep only the waiting ones with nothing to check', () => {
    const easy = listEasySuggestions([
      proposal('waiting', rewrite('b1', B1, 'Did it')),
      proposal('kept', rewrite('b1', B1, 'Led it'), 'accepted'),
      flagged('flagged'),
      proposal('entry', newEntryAfterHarbor),
    ]);

    expect(easy.map((each) => each.id)).toEqual(['waiting']);
  });
});

describe('isPlaceFolded', () => {
  const [place] = groupOnPage([
    proposal('kept', rewrite('b1', B1, 'Led it'), 'accepted'),
    proposal('dropped', addText('bullet', 'b3', 'Mentored two engineers'), 'rejected'),
  ]);

  it('folds a card once every suggestion in it is decided', () => {
    expect(isPlaceFolded(place, null, undefined)).toBe(true);
  });

  it('keeps it open while one of its suggestions is selected', () => {
    expect(isPlaceFolded(place, 'dropped', undefined)).toBe(false);
  });

  it('follows the user when they fold or open it themselves', () => {
    expect(isPlaceFolded(place, null, false)).toBe(false);
    expect(isPlaceFolded(place, 'dropped', true)).toBe(true);
  });
});
