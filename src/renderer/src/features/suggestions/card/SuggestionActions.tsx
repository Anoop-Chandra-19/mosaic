import { Check, Pencil, RotateCcw, Trash2, Undo2, X, type LucideIcon } from 'lucide-react';
import { AppButton, Text } from '@/components/ui-kit';
import { useShortcutLabel } from '@/features/shortcuts/shortcutBindings';
import { cn } from '@/lib/utils';
import type { Proposal } from '@shared/types/agentProposal';
import {
  acceptProposals,
  placeProposalLast,
  rejectProposals,
  returnProposals,
  reviewStaleProposalAnyway,
} from '../proposals/proposalActions';
import { findUnconfirmedFacts } from '../proposals/reviewedChange';
import { canEditSuggestion } from '../suggestionState';

interface SuggestionActionsProps {
  proposal: Proposal;
  isEditing: boolean;
  onEditingChange: (isEditing: boolean) => void;
}

/** Drop, Edit and Keep: Keep and Drop are toggles that name their state and, on hover, the undo. */
export function SuggestionActions({
  proposal,
  isEditing,
  onEditingChange,
}: SuggestionActionsProps) {
  const keepKeys = useShortcutLabel('keepSuggestion');
  const dropKeys = useShortcutLabel('dropSuggestion');
  const editKeys = useShortcutLabel('editSuggestion');
  if (proposal.isStale) return <StaleActions proposal={proposal} />;
  const factsLeft = findUnconfirmedFacts(proposal).length;
  return (
    <>
      {proposal.status === 'rejected' ? (
        <DecidedToggle
          variant="dropped"
          title={`Dropped. Click to undo  ${dropKeys}`.trim()}
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
      {canEditSuggestion(proposal) && (
        <AppButton
          variant="outline"
          size="sm"
          aria-pressed={isEditing}
          title={`Rewrite it in your words  ${editKeys}`.trim()}
          onClick={() => onEditingChange(!isEditing)}
          className="aria-pressed:border-line-heavy aria-pressed:bg-line"
        >
          <Pencil />
          Edit
        </AppButton>
      )}
      {proposal.status === 'accepted' ? (
        <DecidedToggle
          variant="kept"
          title={`Kept. Click to undo  ${keepKeys}`.trim()}
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

/** Its way back while out of date: looked at again against the edit, or put last. */
function readStaleRecovery(proposal: Proposal) {
  switch (proposal.change.kind) {
    case 'rewrite':
    case 'merge':
    case 'rename':
      return {
        label: 'Use it anyway…',
        title: 'Compare with your edit, then decide',
        run: () => reviewStaleProposalAnyway(proposal.id),
      };
    case 'add':
      return {
        label: 'Put it last',
        title: 'Place it at the end, then decide',
        run: () => placeProposalLast(proposal.id),
      };
    default:
      return null;
  }
}

/** Out of date: it can't be kept as it is, only discarded, or brought back another way. */
function StaleActions({ proposal }: { proposal: Proposal }) {
  const isDiscarded = proposal.status === 'rejected';
  const recovery = readStaleRecovery(proposal);
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
      {recovery ? (
        <AppButton variant="outline" size="sm" title={recovery.title} onClick={recovery.run}>
          <RotateCcw />
          {recovery.label}
        </AppButton>
      ) : (
        <Text variant="secondary" className="flex-1 text-ink-faint">
          Can’t be kept while it’s out of date.
        </Text>
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
      // The visible face follows the pointer; the name mustn't.
      aria-label={decided.label}
      title={title}
      onClick={onClick}
      className="group/toggle inline-grid"
    >
      {face(decided, 'group-hover/toggle:invisible group-focus-visible/toggle:invisible')}
      {face(undo, 'invisible group-hover/toggle:visible group-focus-visible/toggle:visible')}
    </AppButton>
  );
}
