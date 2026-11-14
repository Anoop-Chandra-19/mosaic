import type { ResumeData } from '@shared/types/resume';
import { useProposalStore } from '@/stores/proposalStore';
import { getResumeSnapshot, useResumeStore } from '@/stores/resumeStore';
import { findOutOfDateIds } from './workingCopy';

/**
 * Update which of a template's suggestions are out of date. A suggestion can become
 * current again, for example after an undo or after a drop is undone. This never deletes
 * a suggestion, because an out-of-date card explains why it is out of date.
 */
export function recheckProposals(templateId: string, draft: ResumeData): void {
  const store = useProposalStore.getState();
  const proposals = store.byTemplate[templateId] ?? [];
  const outOfDateIds = findOutOfDateIds(draft, proposals);
  const changed = proposals
    .filter((proposal) => proposal.status !== 'applied')
    .filter((proposal) => proposal.isStale !== outOfDateIds.has(proposal.id))
    .map((proposal) => ({ ...proposal, isStale: outOfDateIds.has(proposal.id) }));
  if (changed.length) store.replaceProposals(templateId, changed);
}

/** Recheck the open draft's suggestions. Call this after one is dropped, restored or edited. */
export function recheckOpenProposals(): void {
  const { templateId } = useResumeStore.getState();
  if (templateId !== null) recheckProposals(templateId, getResumeSnapshot());
}

let stopWatching: (() => void) | null = null;

/**
 * Rechecks the open draft's proposals whenever its document changes: an edit, undo, import,
 * restore, or opening another template. Started by the first proposal staged, so with the
 * assistant unused, nothing watches.
 */
export function watchProposalAnchors(): void {
  stopWatching ??= useResumeStore.subscribe((state, previous) => {
    const isSameDocument =
      state.templateId === previous.templateId && state.sections === previous.sections;
    // Pass the snapshot. The store's state holds functions, which can't be copied.
    if (!isSameDocument && state.templateId) {
      recheckProposals(state.templateId, getResumeSnapshot());
    }
  });
}
