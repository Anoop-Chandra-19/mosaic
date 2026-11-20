import type { Proposal } from '@/types/agentProposal';
import type { ResumeData } from '@shared/types/resume';
import { readSuggestionState } from '../../suggestionState';
import { OpenSuggestion, type OpenSuggestionLook } from './OpenSuggestion';
import { PlaceRow } from './PlaceRow';

/** What the inspector's cards and Compare all both need to show the suggestions of a place. */
export interface PlaceViewProps {
  draft: ResumeData;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  editingId: string | null;
  onEditingChange: (id: string | null) => void;
  /** Each suggestion's number, in the order the assistant made them, by suggestion id. */
  numbers: ReadonlyMap<string, number>;
  /** The suggestions whose row of drop reasons the user closed. */
  dismissedReasonIds: readonly string[];
  onDismissReasons: (id: string) => void;
}

interface PlaceSuggestionProps {
  proposal: Proposal;
  look: OpenSuggestionLook;
  isOpen: boolean;
  view: PlaceViewProps;
}

/** One suggestion of a place: open in full, or folded to one line that opens it when clicked. */
export function PlaceSuggestion({ proposal, look, isOpen, view }: PlaceSuggestionProps) {
  const isSelected = proposal.id === view.selectedId;
  if (!isOpen) {
    return (
      <PlaceRow
        proposal={proposal}
        draft={view.draft}
        isSelected={isSelected}
        onClick={() => view.onSelect(proposal.id)}
        className={look === 'document' ? 'px-4' : undefined}
      />
    );
  }
  const isDropped = readSuggestionState(proposal) === 'dropped';
  return (
    <OpenSuggestion
      proposal={proposal}
      number={view.numbers.get(proposal.id) ?? 0}
      draft={view.draft}
      look={look}
      isSelected={isSelected}
      onSelect={view.onSelect}
      isEditing={view.editingId === proposal.id}
      onEditingChange={view.onEditingChange}
      isOfferingReasons={isSelected && isDropped && !view.dismissedReasonIds.includes(proposal.id)}
      onDismissReasons={() => view.onDismissReasons(proposal.id)}
    />
  );
}
