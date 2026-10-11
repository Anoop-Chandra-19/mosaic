import type { AppliedHistory } from '@shared/types/db';
import { canAddToVersion } from '@shared/history/canAddToVersion';
import { useProposalStore } from '@/stores/proposalStore';
import { getResumeSnapshot, useResumeStore } from '@/stores/resumeStore';
import { useTemplateStore } from '@/stores/templateStore';
import { useUiStore } from '@/stores/uiStore';
import { describeLandedSuggestions } from './describeSuggestion';
import { planApply, type ApplyPlan } from './planApply';

export type ApplyOutcome =
  | { kind: 'applied'; plan: ApplyPlan }
  /** Nothing kept could land. */
  | { kind: 'nothing'; plan: ApplyPlan }
  /** "Add to" was chosen, but the newest version can't be added to any more. Nothing changed. */
  | { kind: 'cannotAdd' };

function undoLabel(count: number): string {
  return count === 1 ? 'apply a suggestion' : `apply ${count} suggestions`;
}

/**
 * Whether this apply can add to the newest version: it is the assistant's, and the draft
 * still matches it, so the user's own edits never end up inside an assistant version.
 */
export function canAddToAppliedVersion(): boolean {
  const { templateId, rev } = useResumeStore.getState();
  const head = useTemplateStore.getState().templates.find((t) => t.id === templateId)?.head;
  return !!head && head.rev === rev && canAddToVersion(head, 'assistant', Date.now());
}

/**
 * Lands the open draft's kept suggestions as one edit: one undo takes them all back.
 * History keeps the draft as it was before them and as it is after, as `history` says,
 * unless the user turned those versions off; a name they gave is always kept.
 */
export async function applyAcceptedProposals(
  history: AppliedHistory = { mode: 'new' }
): Promise<ApplyOutcome> {
  const templateId = useResumeStore.getState().templateId;
  if (templateId === null) throw new Error('No template is open');
  if (history.mode === 'add' && !canAddToAppliedVersion()) return { kind: 'cannotAdd' };

  const draft = getResumeSnapshot();
  const plan = planApply(draft, useProposalStore.getState().byTemplate[templateId] ?? []);
  if (!plan.landed.length) return { kind: 'nothing', plan };

  const shouldKeepVersions =
    useUiStore.getState().snapshotTriggers.afterAiEdits || history.mode === 'named';
  const { snapshotBeforeApply, snapshotApplied } = useTemplateStore.getState();
  if (shouldKeepVersions) await snapshotBeforeApply(templateId);

  useResumeStore.getState().applyDocument(undoLabel(plan.landed.length), plan.doc);
  const proposals = useProposalStore.getState();
  proposals.setStatus(
    templateId,
    plan.landed.map((proposal) => proposal.id),
    'applied'
  );
  // An earlier one changed their bullets first: they wait for the user to look again.
  proposals.setStatus(
    templateId,
    plan.skipped.map(({ proposal }) => proposal.id),
    'pending'
  );

  if (shouldKeepVersions) {
    await snapshotApplied(templateId, describeLandedSuggestions(draft, plan.landed), history);
  }
  return { kind: 'applied', plan };
}
