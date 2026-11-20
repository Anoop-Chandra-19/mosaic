import type { Proposal, ProposalVersion } from '@/types/agentProposal';

/*
 * A suggestion's versions. Every suggestion has at least one. Its active version is the one
 * the page, Preview and Apply use: the version the user kept, or the newest when they
 * haven't kept one. A card can show another version than the active one, so the user can
 * read it before they keep it.
 */

export const readNewestVersion = ({ versions }: Proposal): ProposalVersion =>
  versions[versions.length - 1];

/** Return the suggestion's kept version, or null when the user hasn't kept one. */
export const readKeptVersion = (proposal: Proposal): ProposalVersion | null =>
  proposal.versions.find((version) => version.id === proposal.keptVersionId) ?? null;

/** Return the suggestion's active version: the one the user kept, or else the newest. */
export const readActiveVersion = (proposal: Proposal): ProposalVersion =>
  readKeptVersion(proposal) ?? readNewestVersion(proposal);

/**
 * Return the version with this id. Without an id, or when no version has it, return the
 * active version.
 */
export const findVersion = (proposal: Proposal, versionId?: string | null): ProposalVersion =>
  proposal.versions.find((version) => version.id === versionId) ?? readActiveVersion(proposal);

/** Return the version's number on its card, counting from 1 for the oldest. */
export const readVersionNumber = (proposal: Proposal, versionId: string): number =>
  proposal.versions.findIndex((version) => version.id === versionId) + 1;

/**
 * Return the version a card shows: the one the user chose to show, or else the newest. A
 * chosen version that no longer exists falls back to the newest too.
 */
export const readShownVersion = (proposal: Proposal, shownId?: string | null): ProposalVersion =>
  proposal.versions.find((version) => version.id === shownId) ?? readNewestVersion(proposal);

/** Return a copy of the suggestion with `version` in place of the version that has its id. */
export const replaceVersion = (proposal: Proposal, version: ProposalVersion): Proposal => ({
  ...proposal,
  versions: proposal.versions.map((each) => (each.id === version.id ? version : each)),
});

/** Return a copy of the suggestion with `version` added as its newest version. */
export const addVersion = (proposal: Proposal, version: ProposalVersion): Proposal => ({
  ...proposal,
  versions: [...proposal.versions, version],
});

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

/**
 * Return a copy of the suggestion with the user's keep or drop undone. Undoing a drop
 * brings back the version the user kept before they dropped it, still kept. Anything else
 * goes back to waiting, with nothing kept.
 */
export const undoDecision = (proposal: Proposal): Proposal =>
  proposal.status === 'rejected' && readKeptVersion(proposal)
    ? { ...proposal, status: 'accepted' }
    : returnToWaiting(proposal);
