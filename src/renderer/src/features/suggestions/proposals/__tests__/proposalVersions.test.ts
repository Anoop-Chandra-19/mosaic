import { describe, expect, it } from 'vitest';
import type { Proposal } from '@/types/agentProposal';
import {
  addVersion,
  findVersion,
  keepVersion,
  readActiveVersion,
  readKeptVersion,
  readNewestVersion,
  readShownVersion,
  readVersionNumber,
  replaceVersion,
  returnToWaiting,
  undoDecision,
} from '../proposalVersions';
import { makeProposal, makeResume, rewrite } from './proposalFixtures';

const B1 = makeResume().sections[0].items[0].bullets[0].text;

/** A suggestion for bullet b1 with two versions, `p1-v1` and the newer `p1-v2`, and nothing kept. */
function makeTwoVersions(): Proposal {
  const proposal = makeProposal(rewrite('b1', B1, 'Led the billing migration'), 'p1');
  const [first] = proposal.versions;
  const second = {
    ...first,
    id: 'p1-v2',
    change: rewrite('b1', B1, 'Designed the billing schema'),
  };
  return { ...proposal, versions: [first, second], status: 'pending', keptVersionId: null };
}

describe('readActiveVersion', () => {
  it('reads the newest version while nothing is kept', () => {
    const proposal = makeTwoVersions();
    expect(readActiveVersion(proposal).id).toBe('p1-v2');
    expect(readNewestVersion(proposal).id).toBe('p1-v2');
  });

  it('reads the kept version, even when a newer one waits', () => {
    const kept = keepVersion(makeTwoVersions(), 'p1-v1');
    expect(kept).toMatchObject({ status: 'accepted', keptVersionId: 'p1-v1' });
    expect(readActiveVersion(kept).id).toBe('p1-v1');
  });
});

describe('keepVersion and returnToWaiting', () => {
  it('keeps the active version when no version is named', () => {
    expect(keepVersion(makeTwoVersions()).keptVersionId).toBe('p1-v2');
  });

  it('forgets the kept version when the suggestion waits again', () => {
    const waiting = returnToWaiting(keepVersion(makeTwoVersions(), 'p1-v1'));
    expect(waiting).toMatchObject({ status: 'pending', keptVersionId: null });
    expect(readActiveVersion(waiting).id).toBe('p1-v2');
  });
});

describe('undoDecision', () => {
  it('brings back the kept version, still kept, when a drop is undone', () => {
    const dropped: Proposal = { ...keepVersion(makeTwoVersions(), 'p1-v1'), status: 'rejected' };
    expect(undoDecision(dropped)).toMatchObject({ status: 'accepted', keptVersionId: 'p1-v1' });
  });

  it('sets a suggestion back to waiting when a keep is undone, or a drop of nothing kept', () => {
    const kept = keepVersion(makeTwoVersions(), 'p1-v1');
    expect(undoDecision(kept)).toMatchObject({ status: 'pending', keptVersionId: null });
    const dropped: Proposal = { ...makeTwoVersions(), status: 'rejected' };
    expect(undoDecision(dropped)).toMatchObject({ status: 'pending', keptVersionId: null });
  });
});

describe('the versions a card shows and acts on', () => {
  it('shows the version chosen, or the newest when none is chosen or it is gone', () => {
    const proposal = keepVersion(makeTwoVersions(), 'p1-v1');
    expect(readShownVersion(proposal, 'p1-v1').id).toBe('p1-v1');
    expect(readShownVersion(proposal).id).toBe('p1-v2');
    expect(readShownVersion(proposal, 'gone').id).toBe('p1-v2');
  });

  it('acts on the version named, or the active one without a name', () => {
    const proposal = keepVersion(makeTwoVersions(), 'p1-v1');
    expect(findVersion(proposal, 'p1-v2').id).toBe('p1-v2');
    expect(findVersion(proposal).id).toBe('p1-v1');
  });

  it('numbers versions from 1, oldest first, and adds a new one last', () => {
    const proposal = makeTwoVersions();
    const third = { ...proposal.versions[1], id: 'p1-v3' };
    expect(readVersionNumber(proposal, 'p1-v2')).toBe(2);
    expect(readVersionNumber(addVersion(proposal, third), 'p1-v3')).toBe(3);
    expect(readKeptVersion(proposal)).toBeNull();
  });
});

describe('replaceVersion', () => {
  it('replaces only the version with the same id', () => {
    const proposal = makeTwoVersions();
    const edited = { ...proposal.versions[0], review: { userText: 'Ran the billing migration' } };
    const replaced = replaceVersion(proposal, edited);
    expect(replaced.versions.map((version) => version.review)).toEqual([
      { userText: 'Ran the billing migration' },
      {},
    ]);
  });
});
