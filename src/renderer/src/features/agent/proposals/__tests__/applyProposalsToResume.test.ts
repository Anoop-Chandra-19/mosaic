import { describe, expect, it } from 'vitest';
import type { ProposalChange } from '@shared/types/agent';
import { applyProposalsToResume } from '../applyProposalsToResume';
import { makeProposal, makeResume, rewrite } from './proposalFixtures';

const B1 = 'Assisted in migrating billing to Postgres';
const B2 = 'Reduced p99 latency from 18% to 3% of requests';

function sequentialIds() {
  let next = 0;
  return () => `new${++next}`;
}

const bulletsOf = (doc: ReturnType<typeof makeResume>, entryIndex = 0) =>
  doc.sections[0].items[entryIndex].bullets.map(({ id, text, selected }) => ({
    id,
    text,
    selected,
  }));

describe('applyProposalsToResume', () => {
  it('applies each kind of change, and leaves the input alone', () => {
    const doc = makeResume();
    const changes: ProposalChange[] = [
      rewrite('b1', B1, 'Led the billing migration to Postgres'),
      {
        kind: 'select',
        sectionId: 's1',
        entryId: 'e1',
        bulletId: 'b3',
        before: doc.sections[0].items[0].bullets[2].text,
        selected: false,
      },
      {
        kind: 'split',
        sectionId: 's1',
        entryId: 'e1',
        bulletId: 'b2',
        before: B2,
        at: 'Reduced p99 latency'.length,
      },
      { kind: 'reorder', sectionId: 's1', before: ['e1', 'e2'], after: ['e2', 'e1'] },
      {
        kind: 'entry',
        sectionId: 's1',
        afterEntryId: 'e2',
        frame: { title: 'Volunteer', organization: 'Riverside Library' },
        bullets: ['Taught weekly coding classes', '  '],
      },
    ];
    const result = applyProposalsToResume(
      doc,
      changes.map((change, index) => makeProposal(change, `p${index}`)),
      sequentialIds()
    );

    expect(result.skippedIds).toEqual([]);
    expect(result.doc.sections[0].items.map((entry) => entry.id)).toEqual(['e2', 'new2', 'e1']);
    expect(bulletsOf(result.doc, 2)).toEqual([
      { id: 'b1', text: 'Led the billing migration to Postgres', selected: true },
      { id: 'b2', text: 'Reduced p99 latency', selected: true },
      { id: 'new1', text: 'from 18% to 3% of requests', selected: true },
      { id: 'b3', text: 'Wrote the on-call runbook for the payments team', selected: false },
    ]);
    expect(result.doc.sections[0].items[1]).toMatchObject({
      title: 'Volunteer',
      organization: 'Riverside Library',
      selected: true,
      bullets: [{ id: 'new3', text: 'Taught weekly coding classes', selected: true }],
    });
    expect(doc).toEqual(makeResume());
  });

  it('merges two bullets into the first, which keeps its id', () => {
    const doc = makeResume();
    const [b1, b2] = doc.sections[0].items[0].bullets;
    const merge: ProposalChange = {
      kind: 'merge',
      sectionId: 's1',
      entryId: 'e1',
      firstId: 'b1',
      secondId: 'b2',
      before: [b1.text, b2.text],
      after: 'Moved billing to Postgres, cutting slow requests from 18% to 3%',
    };
    const result = applyProposalsToResume(doc, [makeProposal(merge, 'p1')]);
    expect(bulletsOf(result.doc).map((bullet) => bullet.id)).toEqual(['b1', 'b3']);
    expect(bulletsOf(result.doc)[0].text).toBe(merge.after);
  });

  it('hides a bullet even when a rewrite of it lands too', () => {
    const hide: ProposalChange = {
      kind: 'select',
      sectionId: 's1',
      entryId: 'e1',
      bulletId: 'b1',
      before: B1,
      selected: false,
    };
    const result = applyProposalsToResume(makeResume(), [
      makeProposal(rewrite('b1', B1, 'Led the migration'), 'p1'),
      makeProposal(hide, 'p2'),
    ]);
    expect(result.appliedIds).toEqual(['p2', 'p1']);
    expect(bulletsOf(result.doc)[0]).toMatchObject({ text: 'Led the migration', selected: false });
  });

  it('skips a change an earlier one moved past, instead of forcing it', () => {
    const result = applyProposalsToResume(makeResume(), [
      makeProposal(rewrite('b1', B1, 'Led the migration'), 'p1'),
      makeProposal(rewrite('b1', B1, 'Owned the migration'), 'p2'),
      makeProposal(
        { kind: 'split', sectionId: 's1', entryId: 'e1', bulletId: 'b1', before: B1, at: 8 },
        'p3'
      ),
    ]);
    expect(result.appliedIds).toEqual(['p1']);
    expect(result.skippedIds).toEqual(['p2', 'p3']);
    expect(bulletsOf(result.doc)[0].text).toBe('Led the migration');
  });
});
