import { Check } from 'lucide-react';
import { AppButton } from '@/components/ui-kit';
import type { Proposal } from '@/types/agentProposal';
import { acceptProposals } from '../../proposals/proposalActions';
import { isDecided, listEasySuggestions } from './placeSuggestions';

/**
 * Keep the waiting suggestions of one place that have nothing to check. When some of the
 * waiting ones do need a look, the button says how many it will keep. Shows nothing when
 * none can be kept this way.
 */
export function KeepEasyButton({ proposals }: { proposals: readonly Proposal[] }) {
  const easy = listEasySuggestions(proposals);
  if (easy.length === 0) return null;
  const waitingCount = proposals.filter((proposal) => !isDecided(proposal)).length;
  const label =
    easy.length === waitingCount ? 'Keep all' : `Keep the ${easy.length} with nothing to check`;
  return (
    <AppButton
      variant="outline"
      size="xs"
      title="Keeps the waiting suggestions here that have nothing to check"
      onClick={() => acceptProposals(easy.map((proposal) => proposal.id))}
      className="shrink-0 whitespace-nowrap"
    >
      <Check />
      {label}
    </AppButton>
  );
}
