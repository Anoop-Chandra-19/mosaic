import { ChevronUp } from 'lucide-react';
import { AppButton, Text } from '@/components/ui-kit';
import { cn } from '@/lib/utils';
import type { Proposal } from '@/types/agentProposal';
import type { ResumeData } from '@shared/types/resume';
import { placeSuggestion } from '../../proposals/describeSuggestion';
import { readActiveVersion } from '../../proposals/proposalVersions';
import { DropReasons } from '../../card/DropReasons';
import { SuggestionActions } from '../../card/SuggestionActions';
import { SuggestionBody } from '../../card/SuggestionBody';
import { SuggestionKindChip } from '../../card/SuggestionKindChip';
import { labelSuggestionState, readSuggestionState, STATE_TONES } from '../../suggestionState';

/**
 * How an open suggestion is drawn. In the inspector it sits inside its place's card. In
 * Compare all it is a block of the document, with no box around it.
 */
export type OpenSuggestionLook = 'card' | 'document';

interface OpenSuggestionProps {
  proposal: Proposal;
  /** Its number in the order the assistant made the suggestions, counting from 1. */
  number: number;
  draft: ResumeData;
  look: OpenSuggestionLook;
  isSelected: boolean;
  /** Select this suggestion, or with null, close it. */
  onSelect: (id: string | null) => void;
  isEditing: boolean;
  onEditingChange: (id: string | null) => void;
  /** True when the user dropped it and hasn't closed the row of reasons yet. */
  isOfferingReasons: boolean;
  onDismissReasons: () => void;
}

/** One suggestion, open: its kind and place, the change itself, the reason, and the actions. */
export function OpenSuggestion({
  proposal,
  number,
  draft,
  look,
  isSelected,
  onSelect,
  isEditing,
  onEditingChange,
  isOfferingReasons,
  onDismissReasons,
}: OpenSuggestionProps) {
  const state = readSuggestionState(proposal);
  const version = readActiveVersion(proposal);
  const isDocument = look === 'document';
  // Editing selects the suggestion too, so the keys act on the one being edited.
  const setEditing = (isOn: boolean) => {
    onSelect(proposal.id);
    onEditingChange(isOn ? proposal.id : null);
  };
  return (
    <div
      data-suggestion-row={proposal.id}
      aria-current={isSelected || undefined}
      onPointerDown={() => !isSelected && onSelect(proposal.id)}
      className={cn(
        'relative scroll-my-3',
        isSelected &&
          'before:absolute before:inset-y-0 before:left-0 before:w-0.75 before:bg-foreground',
        isDocument ? 'px-4' : 'bg-pane-raised',
        isDocument && isSelected && 'bg-pane-raised'
      )}
    >
      <div
        className={cn('flex items-center gap-2 pt-2.25 pb-0.5', isDocument ? '' : 'pr-2 pl-3.25')}
      >
        <Text variant="meta" className="text-ink-faint">
          {String(number).padStart(2, '0')}
        </Text>
        <SuggestionKindChip change={version.change} />
        <Text variant="secondary" className="min-w-0 truncate text-ink-soft">
          {placeSuggestion(draft, version.change).at(-1)}
        </Text>
        <span className="flex-1" />
        <Text variant="secondary" className={cn('whitespace-nowrap', STATE_TONES[state].text)}>
          {labelSuggestionState(proposal)}
        </Text>
        {!isDocument && (
          <AppButton
            variant="ghost"
            size="2xs"
            shape="square"
            aria-label="Close this suggestion"
            title="Close this suggestion  Esc"
            onClick={() => onSelect(null)}
          >
            <ChevronUp />
          </AppButton>
        )}
      </div>
      <div className={cn('pt-0.5 pb-2.5', isDocument ? '' : 'px-3.25')}>
        <SuggestionBody
          proposal={proposal}
          version={version}
          draft={draft}
          isEditing={isEditing}
          onEditingChange={setEditing}
        />
      </div>
      {isOfferingReasons && (
        <DropReasons proposals={[proposal]} look="one" onDismiss={onDismissReasons} />
      )}
      <div
        className={cn('flex flex-wrap items-center gap-1.5 pb-2.5', isDocument ? '' : 'px-3.25')}
      >
        {version.reason && (
          <Text as="p" variant="secondary" className="mb-1 basis-full text-ink-muted">
            {version.reason}
          </Text>
        )}
        <SuggestionActions proposal={proposal} isEditing={isEditing} onEditingChange={setEditing} />
      </div>
    </div>
  );
}
