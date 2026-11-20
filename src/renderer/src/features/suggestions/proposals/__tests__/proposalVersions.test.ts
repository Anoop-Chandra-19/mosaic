import { describe, expect, it } from 'vitest';
import type { Proposal } from '@/types/agentProposal';
import {
  keepVersion,
  readNewestVersion,
  readActiveVersion,
  replaceVersion,
  returnToWaiting,
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
