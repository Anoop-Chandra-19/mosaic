import { use } from 'react';
import { ChevronUp, Info } from 'lucide-react';
import { AppButton, Text } from '@/components/ui-kit';
import { cn } from '@/lib/utils';
import type { Proposal, ProposalChange } from '@/types/agentProposal';
import type { ResumeData } from '@shared/types/resume';
import { placeSuggestion } from '../../proposals/describeSuggestion';
import { readShownVersion } from '../../proposals/proposalVersions';
import { DropReasons } from '../../card/DropReasons';
import { SuggestionActions } from '../../card/SuggestionActions';
import { SuggestionBody } from '../../card/SuggestionBody';
import { SuggestionKindChip } from '../../card/SuggestionKindChip';
import { VersionCaption } from '../../card/versions/VersionCaption';
import { VersionList } from '../../card/versions/VersionList';
import { describeVersionConsequence } from '../../card/versions/versionWords';
import { SuggestionSelection } from '../../suggestionSelection';
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

/**
 * Check whether the body for this kind of change draws its own version caption.
 * `RewriteBody` draws "Version 3" below the text it replaces, in place of its "Suggested"
 * caption. For every other kind, this card draws the version caption above the body.
 */
const hasOwnVersionCaption = (change: ProposalChange) =>
  change.kind === 'rewrite' || change.kind === 'merge';

/**
 * One suggestion, open: its kind and place, its versions when it has several, the version
 * it shows, the reason, what a click will do to the versions, and the actions.
 */
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
  const { shownVersionIds, showVersion } = use(SuggestionSelection);
  const state = readSuggestionState(proposal);
  const version = readShownVersion(proposal, shownVersionIds[proposal.id]);
  const consequence = describeVersionConsequence(proposal, version);
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
        <VersionList
          proposal={proposal}
          shown={version}
          onShow={(versionId) => showVersion(proposal.id, versionId)}
        />
        {!proposal.isStale && !hasOwnVersionCaption(version.change) && (
          <VersionCaption proposal={proposal} version={version} />
        )}
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
      {consequence && (
        <div
          className={cn(
            'mb-2 flex items-start gap-1.75 border-t border-line py-1.75',
            isDocument ? '' : 'px-3.25'
          )}
        >
          <Info className="mt-0.75 size-3 shrink-0 text-ink-faint" />
          <Text variant="secondary" className="text-pretty text-ink-muted">
            {consequence}
          </Text>
        </div>
      )}
      <div
        className={cn('flex flex-wrap items-center gap-1.5 pb-2.5', isDocument ? '' : 'px-3.25')}
      >
        {version.reason && (
          <Text as="p" variant="secondary" className="mb-1 basis-full text-ink-muted">
            {version.reason}
          </Text>
        )}
        <SuggestionActions
          proposal={proposal}
          version={version}
          isEditing={isEditing}
          onEditingChange={setEditing}
        />
      </div>
    </div>
  );
}
