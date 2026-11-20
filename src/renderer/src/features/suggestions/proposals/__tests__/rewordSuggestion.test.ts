import { beforeEach, describe, expect, it } from 'vitest';
import { useProposalStore } from '@/stores/proposalStore';
import { getResumeSnapshot, useResumeStore } from '@/stores/resumeStore';
import type { ProposalChange, TextPlace } from '@/types/agentProposal';
import { listNewContentIds } from '../newContentIds';
import { readActiveVersion } from '../proposalVersions';
import {
  acceptProposals,
  editProposal,
  rejectProposals,
  returnProposals,
  stageProposals,
  type StagedChange,
} from '../proposalActions';
import { buildWorkingCopy } from '../workingCopy';
import { addText, makeResumeWithLines, rewrite } from './proposalFixtures';

const B1 = 'Assisted in migrating billing to Postgres';
const B2 = 'Reduced p99 latency from 18% to 3% of requests';
const LED = 'Led the billing migration to Postgres';

beforeEach(() => {
  useProposalStore.setState({ byTemplate: {} });
  useResumeStore.getState().loadDraft({ templateId: 't1', doc: makeResumeWithLines(), rev: 1 });
});

const proposals = () => useProposalStore.getState().byTemplate.t1 ?? [];
const changes = () => proposals().map((proposal) => readActiveVersion(proposal).change);
const firstFlagKinds = () => readActiveVersion(proposals()[0]).flags.map((flag) => flag.kind);

const stage = (change: ProposalChange, requestText = '') =>
  stageProposals(requestText, [{ source: change.kind, change } as StagedChange]);

/** Stage a change and return the ids of what it adds, parent first. */
const stageAndListNewIds = (change: ProposalChange) =>
  listNewContentIds(readActiveVersion(stage(change).proposals[0]).newContentIds);

/** Return the text of a bullet or line in the working copy. */
function readWorkingText(id: string): string | undefined {
  const copy = buildWorkingCopy(getResumeSnapshot(), proposals());
  const items = copy.sections.flatMap((section) => section.items);
  return (
    items.find((item) => item.id === id)?.text ??
    items.flatMap((item) => item.bullets).find((bullet) => bullet.id === id)?.text
  );
}

/** Rewrite a bullet of any entry from the text the working copy holds now. */
function rewriteBullet(entryId: string, bulletId: string, after: string): ProposalChange {
  const place: TextPlace = { unit: 'bullet', sectionId: 's1', entryId, bulletId };
  return { kind: 'rewrite', place, before: readWorkingText(bulletId) ?? '', after };
}

describe('a rewrite of text that a waiting rewrite wrote', () => {
  it('changes that suggestion and makes no second one', () => {
    stage(rewrite('b1', B1, LED));
    const result = stage(rewrite('b1', LED, 'Led billing to Postgres'));

    expect(result.proposals).toEqual([]);
    expect(result.reworded).toMatchObject([{ index: 0, isRemoved: false }]);
    expect(changes()).toMatchObject([
      { kind: 'rewrite', before: B1, after: 'Led billing to Postgres' },
    ]);
  });

  it('is checked against the user’s text, not the text it replaces', () => {
    stage(rewrite('b1', B1, 'Migrated billing to Postgres'));
    stage(rewrite('b1', 'Migrated billing to Postgres', LED));

    expect(firstFlagKinds()).toEqual(['claimsMore']);
  });

  it('does not flag a number the user gave in the later request', () => {
    stage(rewrite('b1', B1, 'Migrated billing to Postgres'));
    stage(
      rewrite('b1', 'Migrated billing to Postgres', 'Migrated 40 billing tables to Postgres'),
      'Say it was 40 tables'
    );

    expect(firstFlagKinds()).not.toContain('newNumbers');
  });

  it('removes the suggestion when it puts the user’s text back', () => {
    stage(rewrite('b1', B1, LED));
    const result = stage(rewrite('b1', LED, B1));

    expect(result.reworded).toMatchObject([{ isRemoved: true }]);
    expect(proposals()).toEqual([]);
  });

  it('puts a dropped suggestion that started from the old wording out of date', () => {
    const [first] = stage(rewrite('b1', B1, LED)).proposals;
    acceptProposals([first.id]);
    const [stacked] = stage(rewrite('b1', LED, 'Led billing')).proposals;
    rejectProposals([stacked.id]);
    returnProposals([first.id]);

    stage(rewrite('b1', LED, 'Ran the billing migration'));

    expect(proposals().find((each) => each.id === stacked.id)?.isStale).toBe(true);
  });
});

describe('a rewrite of text that the user kept or worded themselves', () => {
  it('is a new suggestion on a kept one', () => {
    const [first] = stage(rewrite('b1', B1, LED)).proposals;
    acceptProposals([first.id]);

    const result = stage(rewrite('b1', LED, 'Led billing'));

    expect(result.reworded).toEqual([]);
    expect(changes()).toMatchObject([{ after: LED }, { before: LED, after: 'Led billing' }]);
  });

  it('is a new suggestion that starts from the user’s own wording on a waiting card', () => {
    const [first] = stage(rewrite('b1', B1, LED)).proposals;
    editProposal(first.id, 'Helped move billing to Postgres');
    returnProposals([first.id]);

    stage(rewrite('b1', 'Helped move billing to Postgres', 'Moved billing to Postgres'));

    expect(changes()).toMatchObject([
      { after: LED },
      { before: 'Helped move billing to Postgres', after: 'Moved billing to Postgres' },
    ]);
  });
});

describe('a rewrite of text that another kind of waiting suggestion wrote', () => {
  it('changes a merge’s text', () => {
    const merged = `${B1} and ${B2}`;
    stage({
      kind: 'merge',
      sectionId: 's1',
      entryId: 'e1',
      firstId: 'b1',
      secondId: 'b2',
      before: [B1, B2],
      after: merged,
    });

    stage(rewrite('b1', merged, 'Migrated billing to Postgres, cutting p99 latency'));

    expect(changes()).toMatchObject([
      {
        kind: 'merge',
        before: [B1, B2],
        after: 'Migrated billing to Postgres, cutting p99 latency',
      },
    ]);
    expect(firstFlagKinds()).toContain('removedDetail');
  });

  it('changes an added bullet’s text', () => {
    const [bulletId] = stageAndListNewIds(addText('bullet', 'b3', 'Ran the on-call rotation'));

    stage(rewriteBullet('e1', bulletId, 'Ran on-call for payments'));

    expect(changes()).toMatchObject([{ kind: 'add', text: 'Ran on-call for payments' }]);
  });

  it('changes one bullet of a new entry', () => {
    const [entryId, , secondBulletId] = stageAndListNewIds({
      kind: 'entry',
      sectionId: 's1',
      frame: { title: 'Mentor' },
      bullets: ['Mentored new engineers', 'Ran the reading group'],
    });

    stage(rewriteBullet(entryId, secondBulletId, 'Ran a weekly reading group'));

    expect(changes()).toMatchObject([
      { kind: 'entry', bullets: ['Mentored new engineers', 'Ran a weekly reading group'] },
    ]);
  });

  it('moves a number to fill with the new wording of a new entry’s bullet', () => {
    const [entryId, firstBulletId] = stageAndListNewIds({
      kind: 'entry',
      sectionId: 's1',
      frame: { title: 'Mentor' },
      bullets: ['Mentored new engineers'],
    });

    const gapped = rewriteBullet(entryId, firstBulletId, 'Mentored {{?}} new engineers');
    if (gapped.kind === 'rewrite') {
      gapped.gap = { withoutNumber: 'Mentored new engineers each year' };
    }
    stage(gapped);
    expect(changes()).toMatchObject([
      { gaps: { [firstBulletId]: { withoutNumber: 'Mentored new engineers each year' } } },
    ]);

    stage(rewriteBullet(entryId, firstBulletId, 'Mentored the new engineers'));
    expect(changes()[0]).toMatchObject({
      bullets: ['Mentored the new engineers'],
      gaps: undefined,
    });
  });

  it('changes a line and the heading of a new section', () => {
    const [sectionId, lineId] = stageAndListNewIds({
      kind: 'section',
      afterSectionId: 's3',
      section: { kind: 'custom', layout: 'lines', label: 'Talks' },
      contents: { layout: 'lines', lines: ['Postgres at scale, 2024'] },
    });

    stage({
      kind: 'rewrite',
      place: { unit: 'line', sectionId, lineId },
      before: 'Postgres at scale, 2024',
      after: 'Postgres at scale, PDX Backend Meetup, 2024',
    });
    stage({ kind: 'rename', sectionId, before: 'Talks', after: 'Speaking' });

    expect(changes()).toMatchObject([
      {
        kind: 'section',
        section: { label: 'Speaking' },
        contents: { lines: ['Postgres at scale, PDX Backend Meetup, 2024'] },
      },
    ]);
  });

  it('removes a waiting rename when it puts the user’s heading back', () => {
    stage({ kind: 'rename', sectionId: 's1', before: 'Experience', after: 'Work Experience' });
    stage({ kind: 'rename', sectionId: 's1', before: 'Work Experience', after: 'Experience' });

    expect(proposals()).toEqual([]);
  });
});

describe('a rewrite of one bullet of a waiting split', () => {
  const split: ProposalChange = {
    kind: 'split',
    sectionId: 's1',
    entryId: 'e1',
    bulletId: 'b2',
    before: B2,
    at: B2.indexOf('from 18%'),
  };

  it('stores both bullets’ text on the split, and the working copy reads it', () => {
    const [secondBulletId] = stageAndListNewIds(split);

    stage(rewriteBullet('e1', secondBulletId, 'Took it from 18% to 3% of requests'));

    expect(changes()).toMatchObject([
      { kind: 'split', halves: ['Reduced p99 latency', 'Took it from 18% to 3% of requests'] },
    ]);
    expect(readWorkingText('b2')).toBe('Reduced p99 latency');
    expect(readWorkingText(secondBulletId)).toBe('Took it from 18% to 3% of requests');
  });

  it('checks the reworded bullets against the user’s one bullet', () => {
    stageAndListNewIds(split);

    stage(rewriteBullet('e1', 'b2', 'Reduced p99 latency by 83%'));

    expect(firstFlagKinds()).toEqual(['calculatedNumbers']);
  });

  it('is a plain cut again when the bullet is put back as it was cut', () => {
    stageAndListNewIds(split);
    stage(rewriteBullet('e1', 'b2', 'Cut p99 latency'));

    stage(rewriteBullet('e1', 'b2', 'Reduced p99 latency'));

    expect(changes()).toEqual([{ ...split, halves: undefined }]);
  });
});
