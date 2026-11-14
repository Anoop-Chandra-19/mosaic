import { findAnchorMismatch } from '@/lib/resume/proposalAnchor';
import type { Proposal } from '@/types/agentProposal';
import type { ResumeData } from '@shared/types/resume';
import { applyProposalsToResume, type AppliedProposals } from './apply/applyProposalsToResume';
import { resolveChange } from './reviewedChange';

/*
 * The working copy is the draft with the active suggestions applied in the order they
 * were made. The assistant reads and edits the working copy, so it can change text that
 * an earlier suggestion wrote. Nothing in this file writes the draft.
 *
 * Each suggestion is checked against the copy built from the suggestions before it. If it
 * does not fit that copy, it is out of date and is not applied. So dropping a suggestion
 * makes later suggestions that changed its text out of date. Undoing the drop makes them
 * current again.
 */

/** A suggestion is active when it is waiting or kept. */
export const isActive = (proposal: Proposal) =>
  proposal.status === 'pending' || proposal.status === 'accepted';

const withReviewedChange = (proposal: Proposal): Proposal => ({
  ...proposal,
  change: resolveChange(proposal),
});

/** Apply the proposals to the draft in the order given, with the user's review edits. */
export function replayProposals(
  draft: ResumeData,
  proposals: readonly Proposal[]
): AppliedProposals {
  return applyProposalsToResume(draft, proposals.map(withReviewedChange));
}

export function buildWorkingCopy(draft: ResumeData, proposals: readonly Proposal[]): ResumeData {
  return replayProposals(draft, proposals.filter(isActive)).doc;
}

/** Build the draft with only the kept suggestions applied. This is the user's own text. */
export function buildKeptCopy(draft: ResumeData, proposals: readonly Proposal[]): ResumeData {
  const kept = proposals.filter((proposal) => proposal.status === 'accepted');
  return replayProposals(draft, kept).doc;
}

/** Build the working copy from only the suggestions made before this one. */
export function buildCopyBefore(
  draft: ResumeData,
  proposals: readonly Proposal[],
  proposalId: string
): ResumeData {
  const index = proposals.findIndex((proposal) => proposal.id === proposalId);
  return buildWorkingCopy(draft, index < 0 ? proposals : proposals.slice(0, index));
}

/**
 * Return the ids of the suggestions that are out of date. A dropped suggestion is checked
 * so its card can say it is out of date, but it is not applied to the copy.
 */
export function findOutOfDateIds(draft: ResumeData, proposals: readonly Proposal[]): Set<string> {
  const outOfDateIds = new Set<string>();
  let copy = draft;
  for (const proposal of proposals) {
    if (proposal.status === 'applied') continue;
    const reviewed = withReviewedChange(proposal);
    if (findAnchorMismatch(copy, reviewed.change)) outOfDateIds.add(proposal.id);
    else if (isActive(proposal)) copy = applyProposalsToResume(copy, [reviewed]).doc;
  }
  return outOfDateIds;
}

/**
 * Return the ids of the waiting suggestions that these suggestions need. A suggestion
 * needs an earlier one when it no longer fits a copy built without the earlier one. The
 * result includes the suggestions that those earlier ones need.
 */
export function findRequiredIds(
  draft: ResumeData,
  proposals: readonly Proposal[],
  proposalIds: readonly string[]
): string[] {
  const requiredIds = new Set(proposalIds);
  const idsToCheck = [...proposalIds];
  while (idsToCheck.length) {
    const index = proposals.findIndex((proposal) => proposal.id === idsToCheck[0]);
    idsToCheck.shift();
    if (index < 0) continue;
    const change = resolveChange(proposals[index]);
    const earlier = proposals.slice(0, index).filter(isActive);
    // An out-of-date suggestion fits no copy, so removing an earlier one proves nothing.
    if (findAnchorMismatch(replayProposals(draft, earlier).doc, change)) continue;
    for (const candidate of earlier) {
      if (candidate.status !== 'pending' || requiredIds.has(candidate.id)) continue;
      const copyWithoutCandidate = replayProposals(
        draft,
        earlier.filter((each) => each !== candidate)
      ).doc;
      if (!findAnchorMismatch(copyWithoutCandidate, change)) continue;
      requiredIds.add(candidate.id);
      idsToCheck.push(candidate.id);
    }
  }
  return [...requiredIds].filter((id) => !proposalIds.includes(id));
}
