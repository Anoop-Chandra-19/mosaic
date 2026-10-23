import type { Proposal, ProposalChange } from '@shared/types/agentProposal';
import { useAgentSettingsStore } from '@/stores/agentSettingsStore';
import { selectTemplateProposals, useProposalStore } from '@/stores/proposalStore';
import { useResumeStore } from '@/stores/resumeStore';
import { readTextPlaceId } from '../proposals/proposalAnchor';

/** The suggestion an editor bullet, line, entry or section points to, and why. */
export interface SuggestionDot {
  proposalId: string;
  isStale: boolean;
  /** What the dot's hover says is waiting: "A new bullet is suggested for this entry." */
  waiting: string;
}

/** What a suggestion puts a dot on in the editor, by id, and what the dot says. */
function readDots(change: ProposalChange): [string, string][] {
  switch (change.kind) {
    case 'rewrite':
    case 'select':
      return [[readTextPlaceId(change.place), 'A suggestion is waiting here.']];
    case 'split':
      return [[change.bulletId, 'A suggestion is waiting here.']];
    case 'merge':
      return [
        [change.firstId, 'A suggestion is waiting here.'],
        [change.secondId, 'A suggestion is waiting here.'],
      ];
    case 'add': {
      const { place } = change;
      return place.unit === 'bullet'
        ? [[place.entryId, 'A new bullet is suggested for this entry.']]
        : [[place.sectionId, 'A new line is suggested for this section.']];
    }
    case 'entry':
      return [[change.sectionId, 'A new entry is suggested for this section.']];
    case 'reorder':
      return [];
  }
}

/**
 * The one waiting on something in the editor: a current one before an out-of-date one, so
 * the dot is hollow only when every suggestion there is out of date.
 */
export function findSuggestionDot(
  proposals: readonly Proposal[],
  id: string
): SuggestionDot | null {
  const waiting = proposals
    .filter((proposal) => proposal.status === 'pending' || proposal.status === 'accepted')
    .flatMap((proposal) =>
      readDots(proposal.change)
        .filter(([dotId]) => dotId === id)
        .map(([, text]) => ({ proposal, text }))
    );
  const shown = waiting.find(({ proposal }) => !proposal.isStale) ?? waiting[0];
  if (!shown) return null;
  return { proposalId: shown.proposal.id, isStale: shown.proposal.isStale, waiting: shown.text };
}

/** Only while AI is on, as the status bar's count. */
export function useSuggestionDot(id: string): SuggestionDot | null {
  const isAgentEnabled = useAgentSettingsStore((s) => s.enabled);
  const templateId = useResumeStore((s) => s.templateId);
  const proposals = useProposalStore((s) => selectTemplateProposals(s, templateId));
  return isAgentEnabled ? findSuggestionDot(proposals, id) : null;
}
