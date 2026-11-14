import type { Proposal } from '@/types/agentProposal';
import type { AppliedHistory } from '@shared/types/db';
import { canAddToVersion } from '@shared/history/canAddToVersion';
import { useProposalStore } from '@/stores/proposalStore';
import { getResumeSnapshot, useResumeStore } from '@/stores/resumeStore';
import { useTemplateStore } from '@/stores/templateStore';
import { useUiStore } from '@/stores/uiStore';
import { describeLandedSuggestions } from '../describeSuggestion';
import { recheckProposals } from '../recheckProposals';
import { planApply, type ApplyPlan } from './planApply';

export type ApplyOutcome =
  | { kind: 'applied'; plan: ApplyPlan }
  /** No kept suggestion could be applied. */
  | { kind: 'nothing'; plan: ApplyPlan }
  /** The user chose "Add to", but the newest version can no longer be added to. Nothing changed. */
  | { kind: 'cannotAdd' };

function undoLabel(count: number): string {
  return count === 1 ? 'apply a suggestion' : `apply ${count} suggestions`;
}

/**
 * Check whether this apply can add to the newest version. It can when that version is the
 * assistant's and the draft still matches it. This keeps the user's own edits out of an
 * assistant version.
 */
export function canAddToAppliedVersion(): boolean {
  const { templateId, rev } = useResumeStore.getState();
  const head = useTemplateStore.getState().templates.find((t) => t.id === templateId)?.head;
  return !!head && head.rev === rev && canAddToVersion(head, 'assistant', Date.now());
}

/**
 * Return the suggestions the saved version will hold: the ones this apply applied. When
 * the apply adds to the assistant's newest version, the ones that version already held
 * are included, so the version's title covers both.
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

/**
 * Check whether an apply saves versions. It always does when the user gave a name.
 * Otherwise it follows the user's setting.
 */
export function keepsAppliedVersions(history: AppliedHistory): boolean {
  return useUiStore.getState().snapshotTriggers.afterAiEdits || history.mode === 'named';
}

/** Write a plan's document to the draft and update its suggestions' statuses. This is the part of Apply the user sees. */
function landPlan(templateId: string, plan: ApplyPlan): void {
  const proposals = useProposalStore.getState();
  // Mark them applied before the draft changes. Otherwise the recheck that follows a draft
  // change would mark them out of date, because the draft already holds their changes.
  proposals.setStatus(
    templateId,
    plan.landed.map((proposal) => proposal.id),
    'applied'
  );
  // Skipped ones were not applied. Set them back to waiting so the user reviews them again.
  proposals.setStatus(
    templateId,
    plan.skipped.map(({ proposal }) => proposal.id),
    'pending'
  );
  useResumeStore.getState().applyDocument(undoLabel(plan.landed.length), plan.doc);
  recheckProposals(templateId, getResumeSnapshot());
}

/**
 * A function that runs `land`, the step that writes the draft. A caller can pass its own
 * to wrap that step, for example in a view transition. The version after the apply is
 * saved only once this function has finished.
 */
export type LandApply = (land: () => void, plan: ApplyPlan) => void | Promise<void>;

const landAtOnce: LandApply = (land) => land();

/**
 * Apply the open draft's kept suggestions as one edit, so one undo reverts all of them.
 * A version is saved before and after, as `history` says. The user can turn those
 * versions off, but a version they named is always saved.
 */
export async function applyAcceptedProposals(
  history: AppliedHistory = { mode: 'new' },
  landApply: LandApply = landAtOnce
): Promise<ApplyOutcome> {
  const templateId = useResumeStore.getState().templateId;
  if (templateId === null) throw new Error('Cannot apply suggestions: no template is open');
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
 * Undo an apply. This only works while the apply is the draft's last edit. The draft
 * goes back one undo step, and the suggestions the apply applied or skipped are kept
 * again, as they were before. The versions the apply saved are not removed.
 */
export function undoAppliedProposals(plan: ApplyPlan): void {
  const templateId = useResumeStore.getState().templateId;
  if (templateId === null) return;
  const ids = [...plan.landed, ...plan.skipped.map(({ proposal }) => proposal)].map((p) => p.id);
  // Set them to kept before the undo. The undo triggers a recheck, which then finds them
  // as kept suggestions that fit the restored draft.
  useProposalStore.getState().setStatus(templateId, ids, 'accepted');
  useResumeStore.getState().undo();
}
