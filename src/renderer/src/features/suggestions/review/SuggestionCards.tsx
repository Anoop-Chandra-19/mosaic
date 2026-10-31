import { useEffect, useRef } from 'react';
import { Text } from '@/components/ui-kit';
import { transitionClasses } from '@/features/view-transitions/transitionClasses';
import { cn } from '@/lib/utils';
import type { Proposal } from '@/types/agentProposal';
import type { ResumeData } from '@shared/types/resume';
import { placeSuggestion } from '../proposals/describeSuggestion';
import { SuggestionActions } from '../card/SuggestionActions';
import { SuggestionBody } from '../card/SuggestionBody';
import { SuggestionKindChip } from '../card/SuggestionKindChip';
import { labelSuggestionState, readSuggestionState, STATE_TONES } from '../suggestionState';

interface SuggestionCardsProps {
  proposals: Proposal[];
  draft: ResumeData;
  selectedId: string | null;
  onSelect: (id: string) => void;
  editingId: string | null;
  onEditingChange: (id: string | null) => void;
}

/** Compare all: every suggestion as a card, one selection with the inspector. */
export function SuggestionCards({ proposals, draft, selectedId, ...props }: SuggestionCardsProps) {
  const listRef = useRef<HTMLDivElement>(null);

  // The selected card comes into view whole, header included.
  useEffect(() => {
    if (!selectedId) return;
    listRef.current
      ?.querySelector(`[data-suggestion-card="${CSS.escape(selectedId)}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedId]);

  return (
    <div
      ref={listRef}
      className={cn(
        'min-h-0 min-w-0 overflow-auto overscroll-contain border-r border-line bg-pane-sunken px-4.5 pt-4 pb-19',
        // The page slides out for the cards and back, the way the toggle runs.
        transitionClasses({ name: 'page', motion: 'handoff step' })
      )}
    >
      {proposals.map((proposal, index) => (
        <SuggestionCard
          key={proposal.id}
          proposal={proposal}
          number={index + 1}
          draft={draft}
          isSelected={proposal.id === selectedId}
          {...props}
        />
      ))}
    </div>
  );
}

function SuggestionCard({
  proposal,
  number,
  draft,
  isSelected,
  onSelect,
  editingId,
  onEditingChange,
}: Omit<SuggestionCardsProps, 'proposals' | 'selectedId'> & {
  proposal: Proposal;
  number: number;
  isSelected: boolean;
}) {
  const state = readSuggestionState(proposal);
  const isEditing = editingId === proposal.id;
  const setEditing = (isOn: boolean) => {
    onSelect(proposal.id);
    onEditingChange(isOn ? proposal.id : null);
  };
  return (
    <article
      data-suggestion-card={proposal.id}
      aria-label={`Suggestion ${number}`}
      aria-current={isSelected || undefined}
      onPointerDown={() => !isSelected && onSelect(proposal.id)}
      className={cn(
        'relative mb-3.5 scroll-mt-4 scroll-mb-18 overflow-hidden rounded-lg border border-line bg-pane transition-[border-color,box-shadow] duration-140',
        (state === 'kept' || state === 'held') && 'border-add-line',
        isSelected &&
          'border-ink-muted shadow-floating ring-3 ring-line-strong before:absolute before:inset-y-0 before:left-0 before:z-1 before:w-0.75 before:bg-foreground'
      )}
    >
      <header
        className={cn(
          'flex items-center gap-2.25 border-b border-line bg-pane-raised px-2.75 py-2.25',
          isSelected && 'bg-line'
        )}
      >
        <Text variant="meta" className="w-4.5 text-ink-faint">
          {String(number).padStart(2, '0')}
        </Text>
        <SuggestionKindChip change={proposal.change} />
        <Text variant="meta" className="min-w-0 truncate font-control text-ink-soft">
          {placeSuggestion(draft, proposal.change).slice(1).join(' › ')}
        </Text>
        <span className="flex-1" />
        <Text variant="secondary" className={cn('whitespace-nowrap', STATE_TONES[state].text)}>
          {labelSuggestionState(proposal)}
        </Text>
      </header>
      <div className="px-3.25 pt-1 pb-3">
        <SuggestionBody
          proposal={proposal}
          draft={draft}
          isEditing={isEditing}
          onEditingChange={setEditing}
        />
      </div>
      <footer className="flex flex-wrap items-center gap-1.5 border-t border-line bg-pane-raised px-2.75 py-2">
        <Text variant="secondary" className="min-w-40 flex-1 text-ink-muted">
          {proposal.reason}
        </Text>
        <SuggestionActions proposal={proposal} isEditing={isEditing} onEditingChange={setEditing} />
      </footer>
    </article>
  );
}
