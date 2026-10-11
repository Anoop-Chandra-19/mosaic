import { Check, Undo2 } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { Text } from '@/components/Text';
import { ShortcutKeys } from '@/features/shortcuts/ShortcutKeys';
import { getShortcutCombos } from '@/features/shortcuts/shortcutBindings';
import type { Proposal } from '@shared/types/agentProposal';
import type { ApplyPlan } from '../../proposals/planApply';
import { HistoryRail } from './HistoryRail';
import type { HistoryRow } from './planHistoryRows';
import { SuggestionLines, type NameSuggestion } from './SuggestionLines';

/** An apply that landed, as the result shows it. */
export interface AppliedResult {
  plan: ApplyPlan;
  /** The rows it added to history. */
  rows: HistoryRow[];
  /** How many suggestions there were, before it. */
  total: number;
  /** Names read from the draft before it landed, since positions change after. */
  name: NameSuggestion;
}

interface ApplyResultProps {
  result: AppliedResult;
  onUndo: () => void;
  /** Back to reviewing, on one suggestion (Fill it in, Look again) or on what's left. */
  onReviewAgain: (id: string | null) => void;
  onDone: () => void;
}

const describeApplied = (count: number) =>
  `Undo apply ${count} ${count === 1 ? 'suggestion' : 'suggestions'}`;

/** After Apply: what landed, what didn't and why, and what history gained. */
export function ApplyResult({ result, onUndo, onReviewAgain, onDone }: ApplyResultProps) {
  const { plan, rows, total, name } = result;
  const landed = plan.landed.length;
  const skipped = plan.skipped.map(({ proposal }) => proposal);
  const left = plan.held.length + plan.waiting.length + plan.stale.length + skipped.length;
  const skippedWhy = (proposal: Proposal) => {
    const by = plan.skipped.find((each) => each.proposal.id === proposal.id)?.changedBy;
    return by
      ? `${name(by).kind} changed that bullet first.`
      : 'An earlier suggestion changed that bullet first.';
  };
  const lookAgain = (label: string) => (proposal: Proposal) => (
    <AppButton
      variant="link"
      size="xs"
      shape="text"
      className="inline p-0"
      onClick={() => onReviewAgain(proposal.id)}
    >
      {label}
    </AppButton>
  );

  return (
    <>
      <div className="border-b border-line px-3.5 pt-3.5 pb-3">
        <Text as="h3" variant="title" className="mb-0.75 flex items-center gap-2">
          <Check className="size-3.75 text-add" />
          Applied {landed} of {total} {total === 1 ? 'suggestion' : 'suggestions'}
        </Text>
        <Text
          as="p"
          variant="secondary"
          className="flex flex-wrap items-center gap-1 text-ink-muted"
        >
          One undo step: <b className="font-control text-ink-soft">{describeApplied(landed)}</b>
          <ShortcutKeys combos={getShortcutCombos('undo').slice(0, 1)} />
        </Text>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-1.5 pb-3">
        <SuggestionLines caption="On your page" tone="land" proposals={plan.landed} name={name} />
        <SuggestionLines
          caption="Held back"
          tone="held"
          proposals={plan.held}
          name={name}
          detail={(proposal) => (
            <>Needs a number only you know. {lookAgain('Fill it in')(proposal)}</>
          )}
        />
        <SuggestionLines
          caption="Skipped"
          proposals={skipped}
          name={name}
          detail={(proposal) => (
            <>
              {skippedWhy(proposal)} {lookAgain('Look again')(proposal)}
            </>
          )}
        />
        <SuggestionLines
          caption="Dropped"
          proposals={plan.dropped}
          name={name}
          note="The assistant hears what you dropped, and any reasons, next turn."
        />
        <SuggestionLines
          caption="Still waiting"
          proposals={[...plan.waiting, ...plan.stale]}
          name={name}
          detail={(proposal) => (proposal.isStale ? 'Out of date' : null)}
        />
        <section className="border-t border-line py-1.5">
          <Text as="h4" variant="tag" className="mb-1">
            History
          </Text>
          <HistoryRail rows={rows} />
          <Text as="p" variant="caption" className="mt-1">
            Undo moves your draft back one apply. The versions stay in history; name or delete them
            there like any row.
          </Text>
        </section>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 border-t border-line px-2.5 py-2.25">
        <AppButton variant="outline" size="sm" onClick={onUndo}>
          <Undo2 />
          Undo apply
        </AppButton>
        <span className="flex-1" />
        {left > 0 && (
          <AppButton variant="ghost" size="sm" onClick={() => onReviewAgain(null)}>
            Review {left} left
          </AppButton>
        )}
        <AppButton variant="solid" size="sm" onClick={onDone}>
          Back to draft
        </AppButton>
      </div>
    </>
  );
}
