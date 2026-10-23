import { useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Info } from 'lucide-react';
import { AppButton, Text } from '@/components/ui-kit';
import { ShortcutKeys } from '@/features/shortcuts/ShortcutKeys';
import { getShortcutCombos, useShortcutLabel } from '@/features/shortcuts/shortcutBindings';
import type { ShortcutId } from '@/lib/shortcutCatalog';
import { cn } from '@/lib/utils';
import type { Proposal } from '@shared/types/agentProposal';
import type { ResumeData } from '@shared/types/resume';
import { placeSuggestion } from '../proposals/describeSuggestion';
import { DropReasons } from './suggestion/DropReasons';
import { SuggestionActions } from './suggestion/SuggestionActions';
import { SuggestionBody } from './suggestion/SuggestionBody';
import { SuggestionKindChip } from './suggestion/SuggestionKindChip';
import {
  countSuggestions,
  labelSuggestionState,
  readSuggestionState,
  STATE_TONES,
} from './suggestionState';
import { SuggestionRow } from './SuggestionRow';

/** How the left side shows the suggestions, which the list's hint speaks to. */
export type ReviewMode = 'page' | 'cards' | 'preview';

interface ReviewInspectorProps {
  proposals: Proposal[];
  /** The draft the suggestions were made for, which names their places. */
  draft: ResumeData;
  mode: ReviewMode;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  editingId: string | null;
  onEditingChange: (id: string | null) => void;
}

/** The right-hand column: every suggestion as a list, or the one being read. */
export function ReviewInspector({ proposals, selectedId, ...props }: ReviewInspectorProps) {
  const index = proposals.findIndex((proposal) => proposal.id === selectedId);
  return index < 0 ? (
    <SuggestionList proposals={proposals} {...props} />
  ) : (
    <SuggestionDetail proposals={proposals} index={index} {...props} />
  );
}

const LIST_HINTS: Record<ReviewMode, string> = {
  page: 'Click a mark on the page to read it beside your words.',
  cards: 'Pick one to read it beside your words.',
  preview: 'Pick one to read it. Keeping or dropping changes the preview at once.',
};

function SuggestionList({
  proposals,
  draft,
  mode,
  onSelect,
}: Pick<ReviewInspectorProps, 'proposals' | 'draft' | 'mode' | 'onSelect'>) {
  const toLook = proposals.filter((p) => !p.isStale && p.status !== 'rejected' && p.flags.length);
  const { stale } = countSuggestions(proposals);
  const notes = [toLook.length && `${toLook.length} to look at`, stale && `${stale} out of date`];
  const note = notes.filter(Boolean).join(', ');
  return (
    <>
      <div className="border-b border-line px-4 pt-4.5 pb-3.5 text-center">
        <Text as="p" variant="strong" className="mb-0.75">
          {proposals.length} {proposals.length === 1 ? 'suggestion' : 'suggestions'}
        </Text>
        <Text as="p" variant="secondary" className="text-pretty text-ink-muted">
          {LIST_HINTS[mode]}
          {note && ` ${note}.`}
        </Text>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {proposals.map((proposal, index) => (
          <SuggestionRow
            key={proposal.id}
            proposal={proposal}
            number={index + 1}
            place={placeSuggestion(draft, proposal.change)}
            onClick={() => onSelect(proposal.id)}
          />
        ))}
      </div>
      <Text
        as="p"
        variant="meta"
        className="flex shrink-0 flex-wrap items-center gap-1 border-t border-line px-3 py-2 text-ink-muted"
      >
        <KeyHint id="nextSuggestion" />/<KeyHint id="previousSuggestion" /> move ·{' '}
        <KeyHint id="keepSuggestion" /> keep · <KeyHint id="dropSuggestion" /> drop ·{' '}
        <KeyHint id="editSuggestion" /> edit
      </Text>
    </>
  );
}

export function KeyHint({ id }: { id: ShortcutId }) {
  return <ShortcutKeys combos={getShortcutCombos(id).slice(0, 1)} />;
}

function SuggestionDetail({
  proposals,
  index,
  draft,
  onSelect,
  editingId,
  onEditingChange,
}: Omit<ReviewInspectorProps, 'selectedId' | 'mode'> & { index: number }) {
  const proposal = proposals[index];
  const state = readSuggestionState(proposal);
  const previous = proposals[index - 1];
  const next = proposals[index + 1];
  const previousKeys = useShortcutLabel('previousSuggestion');
  const nextKeys = useShortcutLabel('nextSuggestion');
  // The reasons row is offered once per drop; dismissed, it stays away for this suggestion.
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const isEditing = editingId === proposal.id;
  const setEditing = (isOn: boolean) => onEditingChange(isOn ? proposal.id : null);
  const isOfferingReasons = state === 'dropped' && !dismissedIds.includes(proposal.id);
  return (
    <>
      <div className="flex shrink-0 items-center gap-1.5 border-b border-line px-2.5 py-2.25">
        <AppButton
          variant="ghost"
          size="xs"
          shape="square"
          aria-label="All suggestions"
          title="All suggestions"
          onClick={() => onSelect(null)}
        >
          <ChevronLeft />
        </AppButton>
        <SuggestionKindChip change={proposal.change} />
        <Text variant="secondary" className={cn('whitespace-nowrap', STATE_TONES[state].text)}>
          {labelSuggestionState(proposal)}
        </Text>
        <span className="flex-1" />
        <Text variant="meta" className="whitespace-nowrap text-ink-faint">
          {index + 1} / {proposals.length}
        </Text>
        <AppButton
          variant="ghost"
          size="xs"
          shape="square"
          aria-label="Previous suggestion"
          title={`Previous  ${previousKeys}`.trim()}
          disabled={!previous}
          onClick={() => previous && onSelect(previous.id)}
        >
          <ChevronUp />
        </AppButton>
        <AppButton
          variant="ghost"
          size="xs"
          shape="square"
          aria-label="Next suggestion"
          title={`Next  ${nextKeys}`.trim()}
          disabled={!next}
          onClick={() => next && onSelect(next.id)}
        >
          <ChevronDown />
        </AppButton>
      </div>
      <Text as="p" variant="meta" className="px-3 pt-2 wrap-break-word text-ink-muted">
        {placeSuggestion(draft, proposal.change).join(' › ')}
      </Text>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-2.5 pb-3">
        <SuggestionBody
          key={proposal.id}
          proposal={proposal}
          draft={draft}
          isEditing={isEditing}
          onEditingChange={setEditing}
        />
        {proposal.reason && (
          <div className="mt-3 flex items-start gap-2 border-t border-line pt-2.5">
            <Info className="mt-0.75 size-3 shrink-0 text-ink-faint" />
            <Text variant="secondary" className="flex-1 text-ink-muted">
              {proposal.reason}
            </Text>
          </div>
        )}
      </div>
      {isOfferingReasons && (
        <DropReasons
          key={proposal.id}
          proposals={[proposal]}
          look="one"
          onDismiss={() => setDismissedIds((ids) => [...ids, proposal.id])}
        />
      )}
      <div className="flex shrink-0 items-center gap-1.5 border-t border-line px-2.5 py-2.25">
        <SuggestionActions proposal={proposal} isEditing={isEditing} onEditingChange={setEditing} />
        <span className="flex-1" />
        {state !== 'stale' && (
          <AppButton
            variant="ghost"
            size="sm"
            disabled={!next}
            onClick={() => next && onSelect(next.id)}
            className="px-2"
          >
            Next
            <ChevronRight />
          </AppButton>
        )}
      </div>
    </>
  );
}
