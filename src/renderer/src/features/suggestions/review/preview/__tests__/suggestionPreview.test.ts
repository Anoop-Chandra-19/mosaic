import { describe, expect, it } from 'vitest';
import type { Proposal, ProposalChange, ProposalStatus } from '@shared/types/agentProposal';
import {
  addText,
  makeProposal,
  makeResume,
  rewrite,
} from '../../../proposals/__tests__/proposalFixtures';
import { buildSuggestionPreview } from '../suggestionPreview';

const B1 = 'Assisted in migrating billing to Postgres';
const B2 = 'Reduced p99 latency from 18% to 3% of requests';

const proposal = (
  id: string,
  change: ProposalChange,
  status: ProposalStatus = 'pending',
  extra: Partial<Proposal> = {}
): Proposal => ({ ...makeProposal(change, id), status, ...extra });

const bulletsOf = (doc: ReturnType<typeof makeResume>) =>
  doc.sections[0].items[0].bullets.map((bullet) => bullet.text);

const gapped = (status: ProposalStatus = 'pending') =>
  proposal(
    'gap',
    {
      ...rewrite('b2', B2, 'Cut slow requests by {{?}}%'),
      gap: { withoutNumber: 'Cut slow requests' },
    },
    status,
    { flags: [{ kind: 'unfilledGap', words: ['{{?}}'] }] }
  );

describe('buildSuggestionPreview, All suggested', () => {
  it('takes every one not dropped as kept, with no marks', () => {
    const preview = buildSuggestionPreview(
      makeResume(),
      [
        proposal('led', rewrite('b1', B1, 'Led the billing migration to Postgres')),
        proposal('cut', rewrite('b2', B2, 'Cut p99 latency'), 'rejected'),
      ],
      'all'
    );
    expect(bulletsOf(preview.doc).slice(0, 2)).toEqual([
      'Led the billing migration to Postgres',
      B2,
    ]);
    expect(preview.landedCount).toBe(1);
    expect(preview.notes.size).toBe(0);
  });

  it('shows the version without a number, and says so', () => {
    const preview = buildSuggestionPreview(makeResume(), [gapped()], 'all');
    expect(bulletsOf(preview.doc)[1]).toBe('Cut slow requests');
    expect(preview.notes.get('gap')).toEqual({ isOnPage: true, text: 'shown without its number' });
  });

  it('shows the first of two that can’t go together, and names it on the other', () => {
    const preview = buildSuggestionPreview(
      makeResume(),
      [
        proposal('first', rewrite('b2', B2, 'Cut p99 latency')),
        proposal('second', rewrite('b2', B2, 'Cut slow requests')),
      ],
      'all'
    );
    expect(bulletsOf(preview.doc)[1]).toBe('Cut p99 latency');
    expect(preview.notes.get('second')).toEqual({
      isOnPage: false,
      text: 'can’t go with suggestion 1, which is shown',
    });
  });

  it('shows a new entry with its facts as written, counting the ones to confirm', () => {
    const entry: ProposalChange = {
      kind: 'entry',
      sectionId: 's1',
      afterEntryId: 'e2',
      frame: { title: 'Mentor', organization: 'Lantern Maps' },
      bullets: ['Mentored new engineers'],
    };
    const preview = buildSuggestionPreview(
      makeResume(),
      [proposal('new', entry, 'pending', { review: { confirmedFacts: ['title'] } })],
      'all'
    );
    expect(preview.doc.sections[0].items[2].title).toBe('Mentor');
    expect(preview.notes.get('new')?.text).toBe('shown with 1 of 2 facts unconfirmed');
  });
});

describe('buildSuggestionPreview, What you kept', () => {
  it('lays in only what Apply would, and says why each other one is off', () => {
    const preview = buildSuggestionPreview(
      makeResume(),
      [
        proposal('kept', rewrite('b1', B1, 'Led the billing migration to Postgres'), 'accepted'),
        gapped('accepted'),
        proposal('wait', rewrite('b3', 'Wrote the on-call runbook for the payments team', 'x')),
        proposal('old', rewrite('b4', 'Built tile caching for the Oslo office', 'y'), 'pending', {
          isStale: true,
        }),
      ],
      'kept'
    );
    expect(bulletsOf(preview.doc)).toEqual([
      'Led the billing migration to Postgres',
      B2,
      'Wrote the on-call runbook for the payments team',
    ]);
    expect(preview.notes.get('gap')?.text).toBe('held back for its number');
    expect(preview.notes.get('wait')).toEqual({ isOnPage: false, text: 'waiting' });
    expect(preview.notes.get('old')?.text).toBe('out of date');
  });

  it('with nothing kept, is the draft as it is', () => {
    const draft = makeResume();
    const preview = buildSuggestionPreview(
      draft,
      [proposal('led', rewrite('b1', B1, 'Led it'))],
      'kept'
    );
    expect(preview.landedCount).toBe(0);
    expect(bulletsOf(preview.doc)).toEqual(bulletsOf(draft));
  });
});

describe('buildSuggestionPreview, outlines', () => {
  it('outlines the text a suggestion changed, and what an added one made', () => {
    const preview = buildSuggestionPreview(
      makeResume(),
      [
        proposal('led', rewrite('b1', B1, 'Led it')),
        proposal('add', addText('bullet', 'b1', 'Ran the on-call rotation')),
      ],
      'all'
    );
    expect(preview.targets.get('led')).toEqual([{ part: 'bullet', id: 'b1' }]);
    const added = preview.doc.sections[0].items[0].bullets[1];
    expect(preview.targets.get('add')).toEqual([{ part: 'bullet', id: added.id }]);
  });

  it('outlines a renamed heading, and the sections a new order moved', () => {
    const doc = makeResume();
    doc.sections.push({ ...doc.sections[0], id: 's2', label: 'Projects', order: 1, items: [] });
    const preview = buildSuggestionPreview(
      doc,
      [
        proposal('rename', {
          kind: 'rename',
          sectionId: 's1',
          before: 'Experience',
          after: 'Work',
        }),
        proposal('order', {
          kind: 'reorder',
          place: { unit: 'sections' },
          before: ['s1', 's2'],
          after: ['s2', 's1'],
        }),
      ],
      'all'
    );
    expect(preview.targets.get('rename')).toEqual([{ part: 'heading', id: 's1' }]);
    expect(preview.targets.get('order')).toEqual([{ part: 'heading', id: 's2' }]);
  });
});
