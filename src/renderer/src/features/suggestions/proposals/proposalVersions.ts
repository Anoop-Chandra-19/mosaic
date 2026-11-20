import type { Proposal, ProposalVersion } from '@/types/agentProposal';

/*
 * A suggestion's versions. Every suggestion has at least one. Its active version is the one
 * the page, Preview and Apply use: the version the user kept, or the newest when they
 * haven't kept one.
 */

export const readNewestVersion = ({ versions }: Proposal): ProposalVersion =>
  versions[versions.length - 1];

/** Return the suggestion's active version: the one the user kept, or else the newest. */
export function readActiveVersion(proposal: Proposal): ProposalVersion {
  const keptVersion = proposal.versions.find((version) => version.id === proposal.keptVersionId);
  return keptVersion ?? readNewestVersion(proposal);
}

/** Return a copy of the suggestion with `version` in place of the version that has its id. */
export const replaceVersion = (proposal: Proposal, version: ProposalVersion): Proposal => ({
  ...proposal,
  versions: proposal.versions.map((each) => (each.id === version.id ? version : each)),
});

/** Return a copy of the suggestion with `update` applied to its active version. */
export const updateActiveVersion = (
  proposal: Proposal,
  update: (version: ProposalVersion) => ProposalVersion
): Proposal => replaceVersion(proposal, update(readActiveVersion(proposal)));

/**
 * Return a copy of the suggestion with one version kept. Without `versionId`, it keeps the
 * active version.
 */
export const keepVersion = (
  proposal: Proposal,
  versionId = readActiveVersion(proposal).id
): Proposal => ({ ...proposal, status: 'accepted', keptVersionId: versionId });

/** Return a copy of the suggestion with nothing kept, so it waits for the user again. */
export const returnToWaiting = (proposal: Proposal): Proposal => ({
  ...proposal,
  status: 'pending',
  keptVersionId: null,
});
