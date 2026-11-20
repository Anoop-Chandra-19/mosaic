import { Lock, TriangleAlert } from 'lucide-react';
import { AppButton, Text } from '@/components/ui-kit';
import { cn } from '@/lib/utils';
import type { Proposal } from '@/types/agentProposal';
import type { ResumeData } from '@shared/types/resume';
import { findUnconfirmedFacts } from '../../proposals/reviewedChange';
import {
  FLAG_LABELS,
  labelSuggestionState,
  needsNumber,
  readSuggestionState,
  STATE_TONES,
} from '../../suggestionState';
import { nameSuggestionInPlace } from './placeSuggestions';

interface PlaceRowProps {
  proposal: Proposal;
  draft: ResumeData;
  isSelected: boolean;
  onClick: () => void;
  className?: string;
}

/** A suggestion folded to one line: where it stands, what it changes, and what it needs. */
export function PlaceRow({ proposal, draft, isSelected, onClick, className }: PlaceRowProps) {
  const state = readSuggestionState(proposal);
  const flags = state === 'stale' || state === 'dropped' ? [] : proposal.flags;
  const factsLeft = state === 'waiting' ? findUnconfirmedFacts(proposal).length : 0;
  const FlagIcon = needsNumber(proposal) ? Lock : TriangleAlert;
  return (
    <AppButton
      variant="ghost"
      shape="text"
      aria-current={isSelected || undefined}
      data-suggestion-row={proposal.id}
      onClick={onClick}
      className={cn(
        'flex w-full scroll-my-2 items-center gap-2 rounded-none px-3 py-2 aria-[current=true]:bg-line',
        className
      )}
    >
      <span className={cn('size-1.75 shrink-0 rounded-full', STATE_TONES[state].dot)} />
      <Text
        variant="body"
        className={cn(
          'min-w-0 flex-1 truncate',
          state === 'waiting' || isSelected ? 'text-foreground' : 'text-ink-muted',
          isSelected && 'font-control'
        )}
      >
        {nameSuggestionInPlace(draft, proposal)}
      </Text>
      {factsLeft > 0 && (
        <Text variant="caption" className="whitespace-nowrap text-warn">
          {factsLeft} to confirm
        </Text>
      )}
      {flags.length > 0 && (
        <Text
          variant="meta"
          className="inline-flex items-center gap-0.75 text-warn"
          title={flags.map((flag) => FLAG_LABELS[flag.kind]).join('\n')}
        >
          <FlagIcon className="size-2.5" />
          {flags.length}
        </Text>
      )}
      <Text variant="caption" className={cn('whitespace-nowrap', STATE_TONES[state].text)}>
        {labelSuggestionState(proposal)}
      </Text>
    </AppButton>
  );
}
