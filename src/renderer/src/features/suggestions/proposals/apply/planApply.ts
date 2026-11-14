import { readChangedIds } from '@/lib/resume/proposalAnchor';
import type { Proposal } from '@/types/agentProposal';
import type { ResumeData } from '@shared/types/resume';
import { applyProposalsToResume } from './applyProposalsToResume';
import { resolveChange } from '../reviewedChange';

export interface SkippedProposal {
  proposal: Proposal;
  /** The applied suggestion that changed the same bullets first, or null when there is none. */
  changedBy: Proposal | null;
}

/** What Apply would do with each of a template's open proposals, and the resulting draft. */
export interface ApplyPlan {
  landed: Proposal[];
  /** Kept suggestions that still have a number for the user to fill in. */
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
 * Plan what Apply would do. Kept proposals are applied in the order they were made. A
 * kept proposal is skipped when it no longer fits: an earlier one already changed its
 * bullets, or it changes the text of a suggestion that is not being applied. A kept
 * proposal with a number still to fill is held back. The rest stay as they are.
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
