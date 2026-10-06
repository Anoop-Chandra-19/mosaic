import type { Proposal, ProposalChange, ProposalSource } from '@shared/types/agent';
import { useProposalStore } from '@/stores/proposalStore';
import { getResumeSnapshot, useResumeStore } from '@/stores/resumeStore';
import { checkProposal } from './checkProposal';
import { watchProposalAnchors } from './recheckProposals';
import { validateProposal, type ProposalRefusal } from './validateProposal';

/*
 * Proposals: the assistant's suggested changes to the open draft, waiting for the user.
 *
 * A run stages changes here: `validateProposal` refuses what doesn't fit the draft, and
 * `checkProposal` flags what deserves a look. The user accepts, rejects or edits them;
 * `recheckProposals` marks any the draft has moved past as stale, and back. Then
 * `applyAcceptedProposals` lands the accepted ones through `applyProposalsToResume` as one
 * undo step, with a version either side.
 *
 * Other modules use this file, `applyAcceptedProposals.ts`, and `diffWords.ts` for marks.
 * State is `stores/proposalStore.ts`, which only these files write.
 */

export interface StagedChange {
  change: ProposalChange;
  source: ProposalSource;
  reason?: string;
}

export interface StagingResult {
  proposals: Proposal[];
  /** By the change's place in what was staged, so a run can say which to fix. */
  refusals: { index: number; refusal: ProposalRefusal }[];
}

function openTemplateId(): string {
  const id = useResumeStore.getState().templateId;
  if (id === null) throw new Error('No template is open');
  return id;
}

/** Proposals for the open draft. Each is checked against it; the ones that don't fit are refused. */
export function stageProposals(requestText: string, changes: StagedChange[]): StagingResult {
  const templateId = openTemplateId();
  const doc = getResumeSnapshot();
  const result: StagingResult = { proposals: [], refusals: [] };
  changes.forEach(({ change, source, reason }, index) => {
    const refusal = validateProposal(doc, change);
    if (refusal) {
      result.refusals.push({ index, refusal });
      return;
    }
    result.proposals.push({
      id: crypto.randomUUID(),
      templateId,
      source,
      change,
      status: 'pending',
      isStale: false,
      flags: checkProposal(change, requestText),
      reason,
      requestText,
      createdAt: Date.now(),
    });
  });
  if (result.proposals.length) {
    watchProposalAnchors();
    useProposalStore.getState().addProposals(templateId, result.proposals);
  }
  return result;
}

export function acceptProposals(ids: readonly string[]): void {
  useProposalStore.getState().setStatus(openTemplateId(), ids, 'accepted');
}

export function rejectProposals(ids: readonly string[]): void {
  useProposalStore.getState().setStatus(openTemplateId(), ids, 'rejected');
}

/** Gone from review, as if never suggested. All of the open draft's, or only these. */
export function discardProposals(ids?: readonly string[]): void {
  useProposalStore.getState().removeProposals(openTemplateId(), ids);
}

/** The text a proposal writes, as the user corrected it. */
function withAfter(change: ProposalChange, after: string): ProposalChange | null {
  switch (change.kind) {
    case 'rewrite':
      // The user wrote their own version, so the gap and its way out are theirs to settle.
      return { ...change, after, gap: undefined };
    case 'merge':
      return { ...change, after };
    default:
      return null;
  }
}

/**
 * The user's own wording for a rewrite or merge, checked again: their numbers are theirs, so
 * the request now includes what they typed. Accepts it, since editing is saying yes to it.
 */
export function editProposal(id: string, after: string): boolean {
  const templateId = openTemplateId();
  const store = useProposalStore.getState();
  const proposal = store.byTemplate[templateId]?.find((p) => p.id === id);
  const change = proposal && withAfter(proposal.change, after);
  if (!proposal || !change || validateProposal(getResumeSnapshot(), change)) return false;
  const requestText = `${proposal.requestText}\n${after}`;
  store.replaceProposals(templateId, [
    {
      ...proposal,
      change,
      requestText,
      flags: checkProposal(change, requestText),
      status: 'accepted',
    },
  ]);
  return true;
}
