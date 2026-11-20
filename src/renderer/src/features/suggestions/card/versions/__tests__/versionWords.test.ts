import { describe, expect, it } from 'vitest';
import type { Proposal, ProposalChange, ProposalStatus } from '@/types/agentProposal';
import { makeProposal, rewrite } from '../../../proposals/__tests__/proposalFixtures';
import { describeVersionConsequence, summarizeVersion } from '../versionWords';

const B1 = 'Assisted in migrating billing to Postgres';

/**
 * A rewrite card with three versions, `p1-v1` to `p1-v3`, the second one kept, in the
 * status given.
 */
function threeVersions(status: ProposalStatus = 'accepted', keptVersionId = 'p1-v2'): Proposal {
  const card = makeProposal(rewrite('b1', B1, 'Led the billing migration'), 'p1');
  const [first] = card.versions;
  const versions = [
    first,
    { ...first, id: 'p1-v2', change: rewrite('b1', B1, 'Designed the billing schema') },
    { ...first, id: 'p1-v3', change: rewrite('b1', B1, 'Designed the schema and its rollback') },
  ];
  return { ...card, versions, status, keptVersionId };
}

const version = (proposal: Proposal, id: string) =>
  proposal.versions.find((each) => each.id === id)!;

describe('describeVersionConsequence', () => {
  it('says keeping the shown version replaces the kept one', () => {
    const card = threeVersions();
    expect(describeVersionConsequence(card, version(card, 'p1-v3'))).toBe(
      'Keeping version 3 makes it what Apply uses, in place of version 2. Version 2 stays listed.'
    );
  });

  it('says a newer version waits while the kept one is shown', () => {
    const card = threeVersions();
    expect(describeVersionConsequence(card, version(card, 'p1-v2'))).toBe(
      'Version 3 is waiting. Version 2 stays what Apply uses until you keep another.'
    );
  });

  it('says what dropping does once the newest is kept, and what Undo drop brings back', () => {
    const keptNewest = threeVersions('accepted', 'p1-v3');
    expect(describeVersionConsequence(keptNewest, version(keptNewest, 'p1-v3'))).toBe(
      'Dropping drops the card. Undo drop brings back version 3 as kept.'
    );
    const dropped = threeVersions('rejected');
    expect(describeVersionConsequence(dropped, version(dropped, 'p1-v3'))).toBe(
      'Undo drop brings back version 2 as kept.'
    );
  });

  it('says nothing with one version, nothing kept, or out of date', () => {
    const single = makeProposal(rewrite('b1', B1, 'Led it'), 'p1');
    expect(describeVersionConsequence(single, single.versions[0])).toBeNull();
    const waiting = threeVersions('pending', '');
    expect(describeVersionConsequence(waiting, version(waiting, 'p1-v3'))).toBeNull();
    const stale = { ...threeVersions(), isStale: true };
    expect(describeVersionConsequence(stale, version(stale, 'p1-v3'))).toBeNull();
  });
});

describe('summarizeVersion', () => {
  it('reads a text version as it writes it, with the user’s words in it', () => {
    const [shown] = makeProposal(rewrite('b1', B1, 'Led it'), 'p1', {
      review: { userText: 'Ran the billing move' },
    }).versions;
    expect(summarizeVersion(shown)).toBe('Ran the billing move');
  });

  it('reads a new entry or section as what it holds, without the entries left out', () => {
    const entry: ProposalChange = {
      kind: 'entry',
      sectionId: 's1',
      frame: { title: 'Volunteer Mentor', organization: 'Code for Portland' },
      bullets: ['Mentored new contributors'],
    };
    expect(summarizeVersion(makeProposal(entry, 'e').versions[0])).toBe(
      'Volunteer Mentor, Code for Portland, with 1 bullet'
    );
    const section: ProposalChange = {
      kind: 'section',
      afterSectionId: 's1',
      section: { kind: 'volunteering', layout: 'entries', label: 'Volunteering' },
      contents: {
        layout: 'entries',
        entries: [
          { frame: { title: 'Mentor' }, bullets: [] },
          { frame: { title: 'Organizer' }, bullets: [] },
        ],
      },
    };
    const [withOneLeftOut] = makeProposal(section, 'v', {
      review: { leftOutEntryIds: ['v-new3'] },
    }).versions;
    expect(summarizeVersion(withOneLeftOut)).toBe('Volunteering, with 1 entry');
  });
});
