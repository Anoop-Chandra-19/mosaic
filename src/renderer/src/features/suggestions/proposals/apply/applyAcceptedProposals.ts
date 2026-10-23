import type { Proposal } from '@shared/types/agentProposal';
import type { AppliedHistory } from '@shared/types/db';
import { canAddToVersion } from '@shared/history/canAddToVersion';
import { useProposalStore } from '@/stores/proposalStore';
import { getResumeSnapshot, useResumeStore } from '@/stores/resumeStore';
import { useTemplateStore } from '@/stores/templateStore';
import { useUiStore } from '@/stores/uiStore';
import { describeLandedSuggestions } from '../describeSuggestion';
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
 * What the version an apply keeps will hold: what it lands, and when it adds to the
 * assistant's newest version, what that version already held, so its title covers both.
 */
export function collectVersionSuggestions(
  isAdding: boolean,
  landed: readonly Proposal[]
): Proposal[] {
  if (!isAdding) return [...landed];
  const { templateId } = useResumeStore.getState();
  const head = useTemplateStore.getState().templates.find((t) => t.id === templateId)?.head;
  const { byTemplate, idsByAppliedVersion } = useProposalStore.getState();
  const heldIds = (head && idsByAppliedVersion[head.id]) ?? [];
  const held = (byTemplate[templateId ?? ''] ?? []).filter((p) => heldIds.includes(p.id));
  return [...held, ...landed];
}

/** Whether an apply with `history` keeps versions: always for a name, else as the user set. */
export function keepsAppliedVersions(history: AppliedHistory): boolean {
  return useUiStore.getState().snapshotTriggers.afterAiEdits || history.mode === 'named';
}

/** Lands a plan in the draft and marks its suggestions: the part of Apply the user sees. */
function landPlan(templateId: string, plan: ApplyPlan): void {
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
}

/**
 * Runs the landing as it comes; a caller can wrap it, as one view transition, and say when
 * it has run: the version after is written only then.
 */
export type LandApply = (land: () => void, plan: ApplyPlan) => void | Promise<void>;

const landAtOnce: LandApply = (land) => land();

/**
 * Lands the open draft's kept suggestions as one edit: one undo takes them all back.
 * History keeps the draft as it was before them and as it is after, as `history` says,
 * unless the user turned those versions off; a name they gave is always kept.
 */
export async function applyAcceptedProposals(
  history: AppliedHistory = { mode: 'new' },
  landApply: LandApply = landAtOnce
): Promise<ApplyOutcome> {
  const templateId = useResumeStore.getState().templateId;
  if (templateId === null) throw new Error('No template is open');
  if (history.mode === 'add' && !canAddToAppliedVersion()) return { kind: 'cannotAdd' };

  const draft = getResumeSnapshot();
  const plan = planApply(draft, useProposalStore.getState().byTemplate[templateId] ?? []);
  if (!plan.landed.length) return { kind: 'nothing', plan };

  const shouldKeepVersions = keepsAppliedVersions(history);
  const { snapshotBeforeApply, snapshotApplied } = useTemplateStore.getState();
  if (shouldKeepVersions) await snapshotBeforeApply(templateId);

  await landApply(() => landPlan(templateId, plan), plan);

  if (shouldKeepVersions) {
    const held = collectVersionSuggestions(history.mode === 'add', plan.landed);
    const title = describeLandedSuggestions(draft, held);
    const version = await snapshotApplied(templateId, title, history);
    if (version) {
      useProposalStore.getState().recordAppliedVersion(
        version.id,
        held.map((proposal) => proposal.id)
      );
    }
  }
  return { kind: 'applied', plan };
}

/**
 * Takes an apply back while it is the last edit: the draft steps back one undo, and what
 * it landed or skipped is kept again, as it was before. The versions it wrote stay.
 */
export function undoAppliedProposals(plan: ApplyPlan): void {
  const templateId = useResumeStore.getState().templateId;
  if (templateId === null) return;
  const ids = [...plan.landed, ...plan.skipped.map(({ proposal }) => proposal)].map((p) => p.id);
  // Kept before the draft steps back, so the recheck finds them against their own text.
  useProposalStore.getState().setStatus(templateId, ids, 'accepted');
  useResumeStore.getState().undo();
}
