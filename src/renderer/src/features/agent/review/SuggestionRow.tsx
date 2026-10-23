import type { ReactNode } from 'react';
import { Lock, TriangleAlert } from 'lucide-react';
import { AppButton, Text } from '@/components/ui-kit';
import { cn } from '@/lib/utils';
import type { Proposal, ProposalChange } from '@shared/types/agentProposal';
import { labelSuggestionKind } from '../proposals/describeSuggestion';
import { FLAG_LABELS, needsNumber, readSuggestionState, STATE_TONES } from './suggestionState';

/** What a row is about: its bullet or entry, or for a new entry, the entry's own name. */
function nameRowTarget(change: ProposalChange, place: string[]): string | undefined {
  if (change.kind !== 'entry') return place.at(-1);
  return change.frame.organization?.trim() || change.frame.title?.trim() || place.at(-1);
}

interface SuggestionRowProps {
  proposal: Proposal;
  number: number;
  place: string[];
  onClick: () => void;
  /** A line under the row's own, such as why Preview leaves it off the page. */
  children?: ReactNode;
}

/** One suggestion in the inspector's list: where it stands, what and where, its flags. */
export function SuggestionRow({ proposal, number, place, onClick, children }: SuggestionRowProps) {
  const state = readSuggestionState(proposal);
  const flags = state === 'stale' || state === 'dropped' ? [] : proposal.flags;
  const isBlocked = needsNumber(proposal);
  const FlagIcon = isBlocked ? Lock : TriangleAlert;
  return (
    <AppButton
      variant="ghost"
      shape="text"
      onClick={onClick}
      className="flex w-full items-center gap-2.25 rounded-[0.4375rem] px-2 py-1.75"
    >
      <span className={cn('size-1.75 shrink-0 rounded-full', STATE_TONES[state].dot)} />
      <span className="min-w-0 flex-1">
        <Text as="span" variant="body" className="block truncate font-control text-foreground">
          {labelSuggestionKind(proposal.change)}, {nameRowTarget(proposal.change, place)}
        </Text>
        <Text as="span" variant="secondary" className="block truncate text-ink-muted">
          {state === 'stale' ? 'Out of date' : place.at(-2)}
        </Text>
        {children}
      </span>
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
      <Text variant="meta" className="text-ink-faint">
        {String(number).padStart(2, '0')}
      </Text>
    </AppButton>
  );
}
