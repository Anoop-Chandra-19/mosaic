import type { Proposal } from '@shared/types/agentProposal';
import { useAgentSettingsStore } from '@/stores/agentSettingsStore';
import { selectTemplateProposals, useProposalStore } from '@/stores/proposalStore';
import { useResumeStore } from '@/stores/resumeStore';
import { readAnchoredBulletIds } from '../proposals/proposalAnchor';

/** The suggestion an editor bullet points to, and whether an edit has put it out of date. */
export interface BulletSuggestion {
  proposalId: string;
  isStale: boolean;
}

/**
 * The one waiting on a bullet: a current one before an out-of-date one, so the dot is
 * hollow only when every suggestion there is out of date.
 */
export function findBulletSuggestion(
  proposals: readonly Proposal[],
  bulletId: string
): BulletSuggestion | null {
  const waiting = proposals.filter(
    (proposal) =>
      (proposal.status === 'pending' || proposal.status === 'accepted') &&
      readAnchoredBulletIds(proposal.change).includes(bulletId)
  );
  const shown = waiting.find((proposal) => !proposal.isStale) ?? waiting[0];
  return shown ? { proposalId: shown.id, isStale: shown.isStale } : null;
}

/** Only while AI is on, as the status bar's count. */
export function useBulletSuggestion(bulletId: string): BulletSuggestion | null {
  const isAgentEnabled = useAgentSettingsStore((s) => s.enabled);
  const templateId = useResumeStore((s) => s.templateId);
  const proposals = useProposalStore((s) => selectTemplateProposals(s, templateId));
  return isAgentEnabled ? findBulletSuggestion(proposals, bulletId) : null;
}
