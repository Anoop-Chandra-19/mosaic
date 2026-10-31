import { useState } from 'react';
import { Check } from 'lucide-react';
import { AppButton, AppInput, Text } from '@/components/ui-kit';
import { cn } from '@/lib/utils';
import type { EntryFact, Proposal } from '@/types/agentProposal';
import { confirmProposalFact, editProposalFact } from '../../proposals/proposalActions';
import { readEntryDraft, resolveChange } from '../../proposals/reviewedChange';
import { readFlaggedWords } from '../text/describeFlag';
import { SuggestionFlags } from '../text/SuggestionFlags';
import { FlaggedText } from '../text/SuggestionText';
import { SuggestedText } from './BodyParts';

const FACT_LABELS: Record<EntryFact, string> = {
  title: 'Title',
  organization: 'Organization',
  location: 'Place',
  dates: 'Dates',
};

const ENTRY_FACTS = Object.keys(FACT_LABELS) as EntryFact[];

/**
 * A new entry's facts, alone or as a new section's first, each confirmed or changed in
 * place, then the bullets it brings, with what the checks noticed in them.
 */
export function EntryFacts({ proposal }: { proposal: Proposal }) {
  const [openFact, setOpenFact] = useState<EntryFact | null>(null);
  const change = readEntryDraft(resolveChange(proposal));
  if (!change) return null;
  const { confirmedFacts = [], factEdits = {} } = proposal.review;
  const facts = ENTRY_FACTS.filter((fact) => change.frame[fact]?.trim());
  const confirmedCount = facts.filter((fact) => confirmedFacts.includes(fact)).length;

  return (
    <div>
      <div className="mb-2 flex justify-between gap-2.5">
        <Text variant="secondary" className="text-ink-soft">
          These are facts about you. Confirm each one.
        </Text>
        <Text variant="meta" className="text-ink-faint">
          {confirmedCount} of {facts.length}
        </Text>
      </div>
      {facts.map((fact) => {
        const value = change.frame[fact] ?? '';
        const isConfirmed = confirmedFacts.includes(fact);
        const label = FACT_LABELS[fact];
        return (
          <div
            key={fact}
            className={cn(
              'mb-1 grid grid-cols-[5.25rem_minmax(0,1fr)_auto_1.5625rem] items-center gap-2 rounded-sm border border-line bg-pane-raised py-1 pr-1 pl-2',
              isConfirmed && 'border-add-line'
            )}
          >
            <Text variant="secondary" className="text-ink-muted">
              {label}
            </Text>
            {openFact === fact ? (
              <AppInput
                autoFocus
                aria-label={label}
                defaultValue={value}
                onBlur={() => setOpenFact(null)}
                onKeyDown={(event) => {
                  event.stopPropagation();
                  if (event.key === 'Enter') {
                    editProposalFact(proposal.id, fact, event.currentTarget.value);
                    setOpenFact(null);
                  } else if (event.key === 'Escape') {
                    setOpenFact(null);
                  }
                }}
                className="h-6 px-1.5"
              />
            ) : (
              <AppButton
                variant="ghost"
                shape="text"
                title="Change it"
                onClick={() => setOpenFact(fact)}
                className="-ml-1 min-w-0 justify-start truncate rounded-[0.25rem] px-1 py-px text-left text-foreground"
              >
                {value}
              </AppButton>
            )}
            <Text variant="meta" className="whitespace-nowrap text-ink-faint">
              {factEdits[fact] !== undefined ? 'your words' : ''}
            </Text>
            <AppButton
              variant={isConfirmed ? 'kept' : 'outline'}
              size="xs"
              shape="square"
              aria-pressed={isConfirmed}
              aria-label={
                isConfirmed ? `${label} confirmed. Click to undo` : `Confirm ${label.toLowerCase()}`
              }
              onClick={() => confirmProposalFact(proposal.id, fact, !isConfirmed)}
              className={cn(!isConfirmed && 'text-ink-faint')}
            >
              <Check />
            </AppButton>
          </div>
        );
      })}
      <div className="mt-2.25">
        {change.bullets.map((bullet, index) => (
          <div key={index} className="flex items-start gap-1.75 [&+&]:mt-1">
            <Text variant="meta" className="min-w-2.5 text-ink-faint">
              •
            </Text>
            <SuggestedText>
              <FlaggedText text={bullet} words={readFlaggedWords(proposal.flags)} />
            </SuggestedText>
          </div>
        ))}
      </div>
      <SuggestionFlags flags={proposal.flags} />
    </div>
  );
}
