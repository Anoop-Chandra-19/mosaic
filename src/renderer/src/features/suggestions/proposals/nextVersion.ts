import type { Proposal, ProposalReview, ProposalVersion } from '@/types/agentProposal';
import { readNewestVersion } from './proposalVersions';
import { reviewedRequestText } from './reviewedChange';

/*
 * Decide which version of a suggestion a later change goes into, and make a new version
 * when the change needs one.
 *
 * The assistant can rewrite text that a suggestion wrote. It can also add an entry, line or
 * bullet to a new section or entry that a suggestion makes. While the user hasn't kept any
 * version, the change edits the newest version. Once the user keeps the newest version, the
 * change makes a new version that copies the kept one, so the version they kept never
 * changes. When the user kept an older version and a newer one is still waiting, the
 * change edits the newer one.
 *
 * Staging calls `findVersionToChange`, then `buildNextVersion` when the answer is a new
 * version.
 */

/** Which version of a suggestion a later change edits. */
export type VersionToChange =
  /** Edit this version. */
  | { kind: 'inPlace'; version: ProposalVersion }
  /** Copy this version into a new version, and edit the copy. */
  | { kind: 'newVersion'; base: ProposalVersion };

/** Check whether the user wrote this text of a version themselves, in review. */
function isUserWording({ review, newContentIds }: ProposalVersion, textId: string): boolean {
  if (newContentIds?.kind === 'section' && newContentIds.sectionId === textId) {
    return review.sectionLabel !== undefined;
  }
  // A new entry's bullet whose number the user filled, or whose version without one they took.
  if (review.filledNumbers?.[textId] || review.withoutNumberIds?.includes(textId)) return true;
  return review.userText !== undefined || !!review.filledNumber || !!review.isWithoutNumber;
}

/**
 * Find the version of a suggestion that a later change edits. `textId` is the id of the
 * text the change rewrites, when it rewrites text.
 *
 * When the user wrote that text in the newest version themselves, the change doesn't edit
 * their words. If they kept a version, it makes a new version. If they kept none, it
 * returns null.
 *
 * Returns null when the change must become a separate suggestion: the suggestion is
 * dropped, applied or out of date, or the case above.
 */
export function findVersionToChange(proposal: Proposal, textId?: string): VersionToChange | null {
  if (proposal.isStale) return null;
  const newest = readNewestVersion(proposal);
  const isUsersText = textId !== undefined && isUserWording(newest, textId);
  if (proposal.status === 'pending') {
    return isUsersText ? null : { kind: 'inPlace', version: newest };
  }
  if (proposal.status !== 'accepted') return null;
  const isNewestKept = proposal.keptVersionId === newest.id;
  return isNewestKept || isUsersText
    ? { kind: 'newVersion', base: newest }
    : { kind: 'inPlace', version: newest };
}

/**
 * Return the part of the user's review of `base` that the new version keeps.
 *
 * It keeps the facts they confirmed or corrected, the entries they left out, and where they
 * placed added text. It drops their own wording, their number and their choice of the text
 * without a number for a rewrite, merge or added text, because the new version replaces
 * that text. The assistant read their wording when it wrote the new text. It also drops
 * what they did to the bullet or heading that `rewrittenTextId` names, for the same reason.
 */
function carryReview(
  { review, newContentIds }: ProposalVersion,
  rewrittenTextId?: string
): ProposalReview {
  const carried: ProposalReview = { ...review };
  delete carried.userText;
  delete carried.filledNumber;
  delete carried.isWithoutNumber;
  if (rewrittenTextId === undefined) return carried;
  const isHeading =
    newContentIds?.kind === 'section' && newContentIds.sectionId === rewrittenTextId;
  const filledNumbers = { ...carried.filledNumbers };
  delete filledNumbers[rewrittenTextId];
  return {
    ...carried,
    sectionLabel: isHeading ? undefined : carried.sectionLabel,
    filledNumbers: Object.keys(filledNumbers).length ? filledNumbers : undefined,
    withoutNumberIds: carried.withoutNumberIds?.filter((id) => id !== rewrittenTextId),
  };
}

/**
 * Return a copy of `base` with a new id, ready for the later change to edit. It has the same
 * change and ids, the part of the user's review that `carryReview` keeps, no reason, and no
 * "just added" labels. Its request text includes every word the user wrote in reviewing
 * `base`, so the checks don't flag a number they gave there as new.
 */
export function buildNextVersion(base: ProposalVersion, rewrittenTextId?: string): ProposalVersion {
  return {
    ...base,
    id: crypto.randomUUID(),
    review: carryReview(base, rewrittenTextId),
    requestText: reviewedRequestText(base),
    reason: undefined,
    createdAt: Date.now(),
    lateIds: undefined,
  };
}
