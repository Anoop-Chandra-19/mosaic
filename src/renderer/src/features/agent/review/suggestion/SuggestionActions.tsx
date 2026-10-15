import { Check, Pencil, RotateCcw, Trash2, Undo2, X, type LucideIcon } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { Text } from '@/components/Text';
import { useShortcutLabel } from '@/features/shortcuts/shortcutBindings';
import { cn } from '@/lib/utils';
import type { Proposal } from '@shared/types/agentProposal';
import {
  acceptProposals,
  rejectProposals,
  returnProposals,
  reviewStaleProposalAnyway,
} from '../../proposals/proposalActions';
import { findUnconfirmedFacts } from '../../proposals/reviewedChange';
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

/** Out of date: it can't be kept as it is, only discarded, or a rewrite looked at again. */
function StaleActions({ proposal }: { proposal: Proposal }) {
  const isDiscarded = proposal.status === 'rejected';
  const canUseAnyway = proposal.change.kind === 'rewrite' || proposal.change.kind === 'merge';
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
      {canUseAnyway ? (
        <AppButton
          variant="outline"
          size="sm"
          title="Compare with your edited bullet, then decide"
          onClick={() => reviewStaleProposalAnyway(proposal.id)}
        >
          <RotateCcw />
          Use it anyway…
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
      title={title}
      onClick={onClick}
      className="group/toggle inline-grid"
    >
      {face(decided, 'group-hover/toggle:invisible group-focus-visible/toggle:invisible')}
      {face(undo, 'invisible group-hover/toggle:visible group-focus-visible/toggle:visible')}
    </AppButton>
  );
}
