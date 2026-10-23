import type { Proposal } from '@shared/types/agentProposal';
import type { ResumeData } from '@shared/types/resume';
import { applyProposalsToResume } from './applyProposalsToResume';
import { readChangedIds } from './proposalAnchor';
import { resolveChange } from './reviewedChange';

export interface SkippedProposal {
  proposal: Proposal;
  /** The kept one that changed the same bullets first, when there is one. */
  changedBy: Proposal | null;
}

/** What Apply would do with a template's open proposals, and the draft it would leave. */
export interface ApplyPlan {
  landed: Proposal[];
  /** Kept, but with a number only the user knows still to fill. */
  held: Proposal[];
  skipped: SkippedProposal[];
  waiting: Proposal[];
  stale: Proposal[];
  dropped: Proposal[];
  doc: ResumeData;
}

const needsNumber = (proposal: Proposal) =>
  proposal.flags.some((flag) => flag.kind === 'unfilledGap');

/**
 * Kept ones land in the apply order; one whose bullets an earlier one already changed is
 * skipped, and one with a gap to fill is held back. The rest wait, as they are.
 */
export function planApply(doc: ResumeData, proposals: readonly Proposal[]): ApplyPlan {
  const open = proposals.filter((proposal) => proposal.status !== 'applied');
  const current = open.filter((proposal) => !proposal.isStale);
  const kept = current.filter((proposal) => proposal.status === 'accepted');
  const ready = kept.filter((proposal) => !needsNumber(proposal));
  const result = applyProposalsToResume(
    doc,
    ready.map((proposal) => ({ ...proposal, change: resolveChange(proposal) }))
  );
  const byId = new Map(ready.map((proposal) => [proposal.id, proposal]));
  const landed = result.appliedIds.map((id) => byId.get(id)!);
  const changedBy = (proposal: Proposal) => {
    const touched = readChangedIds(resolveChange(proposal));
    return (
      landed.find((other) =>
        readChangedIds(resolveChange(other)).some((id) => touched.includes(id))
      ) ?? null
    );
  };
  return {
    landed,
    held: kept.filter(needsNumber),
    skipped: result.skippedIds.map((id) => {
      const proposal = byId.get(id)!;
      return { proposal, changedBy: changedBy(proposal) };
    }),
    waiting: current.filter((proposal) => proposal.status === 'pending'),
    stale: open.filter((proposal) => proposal.isStale && proposal.status !== 'rejected'),
    dropped: open.filter((proposal) => proposal.status === 'rejected'),
    doc: result.doc,
  };
}
