import type { ResumeData } from '@shared/types/resume';
import { useProposalStore } from '@/stores/proposalStore';
import { useResumeStore } from '@/stores/resumeStore';
import { isProposalCurrent } from './proposalAnchor';

/**
 * Marks a template's waiting proposals stale where the draft has moved past their anchor,
 * and current again where it came back (an undo). Never deletes one: a stale card says why.
 */
export function recheckProposals(templateId: string, doc: ResumeData): void {
  const store = useProposalStore.getState();
  const changed = (store.byTemplate[templateId] ?? [])
    .filter((proposal) => proposal.status === 'pending' || proposal.status === 'accepted')
    .map((proposal) => ({ proposal, isStale: !isProposalCurrent(doc, proposal.change) }))
    .filter(({ proposal, isStale }) => proposal.isStale !== isStale)
    .map(({ proposal, isStale }) => ({ ...proposal, isStale }));
  if (changed.length) store.replaceProposals(templateId, changed);
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
    if (!isSameDocument && state.templateId) recheckProposals(state.templateId, state);
  });
}
