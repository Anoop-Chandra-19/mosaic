import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { AppButton, AppTextarea, Text } from '@/components/ui-kit';
import { cn } from '@/lib/utils';
import type { DropReason, Proposal } from '@/types/agentProposal';
import { setDropReasons } from '../proposals/proposalActions';

const REASON_LABELS: Record<DropReason, string> = {
  inaccurate: 'Not accurate',
  overstated: 'Overstated',
  wrongTone: 'Wrong tone',
  keepMyWording: 'Keep my wording',
  other: 'Other',
};

const REASONS = Object.keys(REASON_LABELS) as DropReason[];

type DropReasonsLook = 'one' | 'batch';

const LOOKS: Record<DropReasonsLook, { root: string; label: string; hint: string }> = {
  one: {
    root: 'flex-col gap-1.75 border-t border-line bg-del-soft px-2.5 py-2',
    label: 'Dropped.',
    hint: 'A reason helps the assistant next turn. Optional.',
  },
  batch: {
    root: 'flex-row flex-wrap items-center gap-2.25 border-y border-line bg-pane px-3.5 py-2',
    label: 'Dropped all.',
    hint: 'One reason covers the batch. Optional.',
  },
};

interface DropReasonsProps {
  /** The suggestions the reasons are for: one, or every one Drop all dropped. */
  proposals: Proposal[];
  look: DropReasonsLook;
  onDismiss: () => void;
  className?: string;
}

/**
 * Why they were dropped, offered after the fact and never asked for: dismissing it and
 * ignoring it are the same. The assistant reads it next turn.
 */
export function DropReasons({ proposals, look, onDismiss, className }: DropReasonsProps) {
  const { reasons = [], note } = proposals[0]?.review.dropReasons ?? {};
  const [isNoteOpen, setIsNoteOpen] = useState(!!note);
  const ids = proposals.map((proposal) => proposal.id);
  const toggle = (reason: DropReason) => {
    const next = reasons.includes(reason)
      ? reasons.filter((each) => each !== reason)
      : [...reasons, reason];
    setDropReasons(ids, next, note);
  };
  const { root, label, hint } = LOOKS[look];
  const dismiss = (
    <AppButton
      variant="ghost"
      size="2xs"
      shape="square"
      aria-label="Dismiss"
      title="Dismiss"
      onClick={onDismiss}
    >
      <X />
    </AppButton>
  );
  return (
    <div
      role="group"
      aria-label="Why you dropped it"
      className={cn('flex shrink-0', root, className)}
    >
      <div className="flex items-center gap-2">
        <Text variant="secondary" className="font-control text-ink-soft">
          {label} <span className="font-regular text-ink-faint">{hint}</span>
        </Text>
        {look === 'one' && <span className="flex-1" />}
        {look === 'one' && dismiss}
      </div>
      <div className="flex flex-wrap gap-1.25">
        {REASONS.map((reason) => (
          <AppButton
            key={reason}
            variant="outline"
            size="2xs"
            aria-pressed={reasons.includes(reason)}
            onClick={() => toggle(reason)}
            className="bg-pane text-ink-muted aria-pressed:border-amber-line aria-pressed:bg-amber-soft aria-pressed:text-amber"
          >
            {REASON_LABELS[reason]}
          </AppButton>
        ))}
      </div>
      {look === 'one' &&
        (isNoteOpen ? (
          <AppTextarea
            aria-label="A note for the assistant"
            autoFocus={!note}
            defaultValue={note}
            onKeyDown={(event) => event.stopPropagation()}
            onBlur={(event) => setDropReasons(ids, reasons, event.currentTarget.value)}
            className="min-h-12 bg-background"
          />
        ) : (
          <AppButton
            variant="quiet"
            size="xs"
            className="-ml-2 self-start"
            onClick={() => setIsNoteOpen(true)}
          >
            <Plus />
            Add a note
          </AppButton>
        ))}
      {look === 'batch' && (
        <>
          <span className="flex-1" />
          {dismiss}
        </>
      )}
    </div>
  );
}
