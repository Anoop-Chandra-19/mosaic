import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  EyeOff,
  Info,
  List,
  Lock,
  Move,
  Plus,
  Split,
  Trash2,
  TriangleAlert,
  Type,
  Undo2,
  X,
  type LucideIcon,
} from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { Chip } from '@/components/Chip';
import { Text } from '@/components/Text';
import { ShortcutKeys } from '@/features/shortcuts/ShortcutKeys';
import { getShortcutCombos, useShortcutLabel } from '@/features/shortcuts/shortcutBindings';
import type { ShortcutId } from '@/lib/shortcutCatalog';
import { cn } from '@/lib/utils';
import type { Proposal, ProposalChange } from '@shared/types/agentProposal';
import type { ResumeData } from '@shared/types/resume';
import { acceptProposals, rejectProposals, returnProposals } from '../proposals/proposalActions';
import { labelSuggestionKind, placeSuggestion } from '../proposals/describeSuggestion';
import { findUnconfirmedFacts } from '../proposals/reviewedChange';
import {
  countSuggestions,
  FLAG_LABELS,
  labelSuggestionState,
  needsNumber,
  readSuggestionState,
  STATE_TONES,
} from './suggestionState';

const KIND_ICONS: Record<ProposalChange['kind'], LucideIcon> = {
  rewrite: Type,
  split: Split,
  merge: List,
  reorder: Move,
  select: EyeOff,
  entry: Plus,
};

interface ReviewInspectorProps {
  proposals: Proposal[];
  /** The draft the suggestions were made for, which names their places. */
  draft: ResumeData;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

/** The right-hand column: every suggestion as a list, or the one being read. */
export function ReviewInspector({ proposals, draft, selectedId, onSelect }: ReviewInspectorProps) {
  const index = proposals.findIndex((proposal) => proposal.id === selectedId);
  return index < 0 ? (
    <SuggestionList proposals={proposals} draft={draft} onSelect={onSelect} />
  ) : (
    <SuggestionDetail
      proposals={proposals}
      index={index}
      place={placeSuggestion(draft, proposals[index].change)}
      onSelect={onSelect}
    />
  );
}

function SuggestionList({ proposals, draft, onSelect }: Omit<ReviewInspectorProps, 'selectedId'>) {
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
          Click a mark on the page to read it beside your words.{note && ` ${note}.`}
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
        <KeyHint id="keepSuggestion" /> keep · <KeyHint id="dropSuggestion" /> drop
      </Text>
    </>
  );
}

function KeyHint({ id }: { id: ShortcutId }) {
  return <ShortcutKeys combos={getShortcutCombos(id).slice(0, 1)} />;
}

/** What a row is about: its bullet or entry, or for a new entry, the entry's own name. */
function nameRowTarget(change: ProposalChange, place: string[]): string | undefined {
  if (change.kind !== 'entry') return place.at(-1);
  return change.frame.organization?.trim() || change.frame.title?.trim() || place.at(-1);
}

function SuggestionRow({
  proposal,
  number,
  place,
  onClick,
}: {
  proposal: Proposal;
  number: number;
  place: string[];
  onClick: () => void;
}) {
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

function SuggestionDetail({
  proposals,
  index,
  place,
  onSelect,
}: {
  proposals: Proposal[];
  index: number;
  place: string[];
  onSelect: (id: string | null) => void;
}) {
  const proposal = proposals[index];
  const state = readSuggestionState(proposal);
  const Icon = KIND_ICONS[proposal.change.kind];
  const previous = proposals[index - 1];
  const next = proposals[index + 1];
  const previousKeys = useShortcutLabel('previousSuggestion');
  const nextKeys = useShortcutLabel('nextSuggestion');
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
        <Chip tone="amber">
          <Icon />
          {labelSuggestionKind(proposal.change)}
        </Chip>
        <Text variant="secondary" className={cn('whitespace-nowrap', STATE_TONES[state].text)}>
          {labelSuggestionState(proposal)}
        </Text>
        <span className="flex-1" />
        <Text variant="meta" className="text-ink-faint">
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
      <Text as="p" variant="meta" className="px-3 pt-2 break-words text-ink-muted">
        {place.join(' › ')}
      </Text>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-2.5 pb-3">
        {proposal.reason && (
          <div className="mt-1 flex items-start gap-2 border-t border-line pt-2.5">
            <Info className="mt-0.75 size-3 shrink-0 text-ink-faint" />
            <Text variant="secondary" className="flex-1 text-ink-muted">
              {proposal.reason}
            </Text>
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5 border-t border-line px-2.5 py-2.25">
        <SuggestionActions proposal={proposal} />
        <span className="flex-1" />
        {state !== 'stale' && (
          <AppButton
            variant="ghost"
            size="sm"
            disabled={!next}
            onClick={() => next && onSelect(next.id)}
          >
            Next
            <ChevronRight />
          </AppButton>
        )}
      </div>
    </>
  );
}

/** Keep and drop, each a toggle that names its state and, on hover, what pressing it does. */
export function SuggestionActions({ proposal }: { proposal: Proposal }) {
  const keepKeys = useShortcutLabel('keepSuggestion');
  const dropKeys = useShortcutLabel('dropSuggestion');
  if (proposal.isStale) {
    const isDiscarded = proposal.status === 'rejected';
    return (
      <>
        <AppButton
          variant="outline"
          size="sm"
          disabled={isDiscarded}
          onClick={() => rejectProposals([proposal.id])}
        >
          <Trash2 />
          {isDiscarded ? 'Discarded' : 'Discard'}
        </AppButton>
        <Text variant="secondary" className="flex-1 text-ink-faint">
          Can’t be kept while it’s out of date.
        </Text>
      </>
    );
  }
  const factsLeft = findUnconfirmedFacts(proposal).length;
  return (
    <>
      {proposal.status === 'rejected' ? (
        <DecidedToggle
          variant="dropped"
          title={`Dropped. Click to put it back to waiting  ${dropKeys}`.trim()}
          decided={{ icon: X, label: 'Dropped' }}
          undo={{ icon: Undo2, label: 'Undo drop' }}
          onClick={() => returnProposals([proposal.id])}
        />
      ) : (
        <AppButton
          variant="outline"
          size="sm"
          title={`Drop  ${dropKeys}`.trim()}
          onClick={() => rejectProposals([proposal.id])}
        >
          <X />
          Drop
        </AppButton>
      )}
      {proposal.status === 'accepted' ? (
        <DecidedToggle
          variant="kept"
          title={`Kept. Click to put it back to waiting  ${keepKeys}`.trim()}
          decided={{ icon: Check, label: 'Kept' }}
          undo={{ icon: Undo2, label: 'Undo keep' }}
          onClick={() => returnProposals([proposal.id])}
        />
      ) : (
        <AppButton
          variant="outline"
          size="sm"
          disabled={factsLeft > 0}
          title={factsLeft ? 'Confirm the facts first' : `Keep  ${keepKeys}`.trim()}
          onClick={() => acceptProposals([proposal.id])}
        >
          <Check />
          {factsLeft ? `Confirm ${factsLeft} more` : 'Keep'}
        </AppButton>
      )}
    </>
  );
}

interface ToggleFace {
  icon: LucideIcon;
  label: string;
}

/** Both faces share one cell, so swapping on hover never changes the button's width. */
function DecidedToggle({
  variant,
  title,
  decided,
  undo,
  onClick,
}: {
  variant: 'kept' | 'dropped';
  title: string;
  decided: ToggleFace;
  undo: ToggleFace;
  onClick: () => void;
}) {
  const face = (look: ToggleFace, className: string) => (
    <span className={cn('col-start-1 row-start-1 inline-flex items-center gap-1.5', className)}>
      <look.icon />
      {look.label}
    </span>
  );
  return (
    <AppButton
      variant={variant}
      size="sm"
      aria-pressed
      title={title}
      onClick={onClick}
      className="group/toggle inline-grid"
    >
      {face(decided, 'group-hover/toggle:invisible group-focus-visible/toggle:invisible')}
      {face(undo, 'invisible group-hover/toggle:visible group-focus-visible/toggle:visible')}
    </AppButton>
  );
}
