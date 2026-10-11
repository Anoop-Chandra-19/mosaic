import type { Proposal } from '@shared/types/agentProposal';
import { useProposalStore } from '@/stores/proposalStore';
import { getResumeSnapshot, useResumeStore } from '@/stores/resumeStore';
import { useTemplateStore } from '@/stores/templateStore';
import { useUiStore } from '@/stores/uiStore';
import { applyProposalsToResume } from './applyProposalsToResume';

export interface ApplyOutcome {
  appliedIds: string[];
  /** Accepted, but the draft or an earlier change had moved past them. */
  skippedIds: string[];
  /** Accepted, but holding a gap only the user can fill. */
  blockedIds: string[];
}

const isReady = (proposal: Proposal) =>
  proposal.status === 'accepted' &&
  !proposal.isStale &&
  !proposal.flags.some((flag) => flag.kind === 'unfilledGap');

function undoLabel(count: number): string {
  return count === 1 ? 'apply a suggestion' : `apply ${count} suggestions`;
}

/**
 * Lands the open draft's accepted suggestions as one edit: one undo takes them all back.
 * History keeps the draft as it was before them and as it is after, unless the user turned
 * that off; undoing moves the draft, and both versions stay.
 */
export async function applyAcceptedProposals(): Promise<ApplyOutcome> {
  const templateId = useResumeStore.getState().templateId;
  const outcome: ApplyOutcome = { appliedIds: [], skippedIds: [], blockedIds: [] };
  if (templateId === null) return outcome;

  const proposals = useProposalStore.getState().byTemplate[templateId] ?? [];
  const ready = proposals.filter(isReady);
  outcome.blockedIds = proposals
    .filter((p) => p.status === 'accepted' && !p.isStale && !isReady(p))
    .map((p) => p.id);
  if (!ready.length) return outcome;

  const shouldKeepVersions = useUiStore.getState().snapshotTriggers.afterAiEdits;
  const { snapshotBeforeApply, snapshotApplied } = useTemplateStore.getState();
  if (shouldKeepVersions) await snapshotBeforeApply(templateId);

  const result = applyProposalsToResume(getResumeSnapshot(), ready);
  outcome.appliedIds = result.appliedIds;
  outcome.skippedIds = result.skippedIds;
  if (!result.appliedIds.length) return outcome;

  useResumeStore.getState().applyDocument(undoLabel(result.appliedIds.length), result.doc);
  useProposalStore.getState().setStatus(templateId, result.appliedIds, 'applied');

  if (shouldKeepVersions) {
    const proposed = proposals.filter((p) => p.status !== 'applied').length;
    await snapshotApplied(templateId, result.appliedIds.length, proposed);
  }
  return outcome;
}
