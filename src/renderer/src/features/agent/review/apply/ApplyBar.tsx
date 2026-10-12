import { useState } from 'react';
import { Check, ChevronUp } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import {
  AppPopover,
  AppPopoverAnchor,
  AppPopoverContent,
  AppPopoverTrigger,
} from '@/components/AppPopover';
import { Text } from '@/components/Text';
import { useShortcutLabel } from '@/features/shortcuts/shortcutBindings';
import { transitionClasses } from '@/features/view-transitions/transitionClasses';
import { cn } from '@/lib/utils';
import type { ApplyPlan } from '../../proposals/planApply';
import { ApplyPeek } from './ApplyPeek';
import { isMissingName, type AddToOffer, type HistoryChoice } from './historyChoice';
import { HistoryMenu } from './HistoryMenu';
import type { HistoryRow } from './planHistoryRows';
import type { NameSuggestion } from './SuggestionLines';

interface ApplyBarProps {
  plan: ApplyPlan;
  choice: HistoryChoice;
  onChoiceChange: (choice: HistoryChoice) => void;
  offer: AddToOffer | null;
  rows: HistoryRow[];
  isMenuOpen: boolean;
  onMenuOpenChange: (isOpen: boolean) => void;
  isRefused: boolean;
  onApply: () => void;
  onLater: () => void;
  name: NameSuggestion;
}

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

/** What Apply would do, in one line: "Apply 4 · 1 held back for its number · 2 waiting…". */
function ApplySummary({ plan }: { plan: ApplyPlan }) {
  const landed = plan.landed.length;
  const kept = landed + plan.held.length + plan.skipped.length;
  const waiting = plan.waiting.length;
  const lead = [
    landed > 0 && <b className="font-strong">Apply {landed}</b>,
    kept > 0 && <b className="font-strong">Nothing can apply yet</b>,
    waiting === 0 && <b className="font-strong">Nothing to apply</b>,
    <span className="text-ink-muted">Nothing kept yet</span>,
  ].find(Boolean);
  return (
    <Text variant="secondary" className="whitespace-nowrap @max-[62.5rem]/review:flex-1">
      {lead}
      {plan.held.length > 0 && (
        <span className="text-warn">
          {' '}
          · {plan.held.length} held back for{' '}
          {plural(plan.held.length, 'its number', 'their numbers')}
        </span>
      )}
      {plan.skipped.length > 0 && (
        <span className="text-ink-muted"> · {plan.skipped.length} will be skipped</span>
      )}
      {waiting > 0 && (
        <span className="text-ink-muted">
          {landed > 0 ? ` · ${waiting} waiting stay for later` : ` · ${waiting} waiting`}
        </span>
      )}
    </Text>
  );
}

/** The history button's words, by what Apply will write. */
const CHOICE_LABELS: Record<
  HistoryChoice['mode'],
  (choice: HistoryChoice, offer: AddToOffer | null) => string
> = {
  add: (_, offer) => `Adds to ${offer?.label}`,
  new: (_, offer) => (offer ? 'Separate version' : 'New version'),
  named: ({ name }) => (name.trim() ? `Named “${name.trim()}”` : 'Name it…'),
};

/** Its mark, as the history rail draws what it will write. */
const CHOICE_MARKS: Record<HistoryChoice['mode'], string> = {
  add: 'h-0 w-2.25 border-t-[1.5px] border-dashed border-ink-muted',
  new: 'h-[0.09375rem] w-2.25 bg-ink-muted',
  named: 'mx-px size-1.75 rotate-45 rounded-[0.0625rem] bg-foreground',
};

/**
 * The bar over the page: what Apply would do, Later, how it goes into history, and Apply,
 * which shows its peek on hover or focus. Everything dropped, it only closes the batch.
 */
export function ApplyBar(props: ApplyBarProps) {
  const { plan, choice, offer, isMenuOpen, onMenuOpenChange, onApply, onLater } = props;
  const [isPeeking, setIsPeeking] = useState(false);
  const applyKeys = useShortcutLabel('applySuggestions');
  const landed = plan.landed.length;
  const kept = landed + plan.held.length + plan.skipped.length;
  const isDone = kept === 0 && plan.waiting.length === 0;
  const canApply = landed > 0 && !isMissingName(choice);

  return (
    <div
      role="group"
      aria-label="Apply"
      className={cn(
        'pointer-events-auto flex items-center gap-2.5 rounded-full border border-line-strong bg-pane-raised py-2 pr-2.5 pl-3.5 shadow-floating',
        '@max-[62.5rem]/review:w-full @max-[62.5rem]/review:rounded-none @max-[62.5rem]/review:border-x-0 @max-[62.5rem]/review:border-b-0 @max-[62.5rem]/review:py-1.75 @max-[62.5rem]/review:shadow-none',
        transitionClasses({ name: 'applybar', motion: 'rise' })
      )}
    >
      <ApplySummary plan={plan} />
      <AppButton variant="ghost" size="sm" onClick={onLater}>
        Later
      </AppButton>
      {isDone ? (
        <AppButton
          variant="outline"
          size="sm"
          title="Closes the batch. Your drops and any reasons go to the assistant next turn."
          onClick={onLater}
        >
          Done, nothing to apply
        </AppButton>
      ) : (
        <>
          <AppPopover open={isMenuOpen && landed > 0} onOpenChange={onMenuOpenChange}>
            <AppPopoverTrigger asChild>
              <AppButton
                variant="ghost"
                size="sm"
                disabled={!landed}
                aria-haspopup="dialog"
                title="How Apply goes into history"
                className="text-ink-soft"
              >
                <span aria-hidden className={cn('shrink-0', CHOICE_MARKS[choice.mode])} />
                {CHOICE_LABELS[choice.mode](choice, offer)}
                <ChevronUp className="size-2.75" />
              </AppButton>
            </AppPopoverTrigger>
            <AppPopoverContent side="top" align="end" sideOffset={10} className="w-90">
              <HistoryMenu
                choice={choice}
                onChoiceChange={props.onChoiceChange}
                offer={offer}
                rows={props.rows}
                isRefused={props.isRefused}
                onDone={() => onMenuOpenChange(false)}
              />
            </AppPopoverContent>
          </AppPopover>
          <AppPopover open={isPeeking && !isMenuOpen && landed > 0}>
            <AppPopoverAnchor asChild>
              <AppButton
                variant="accent"
                size="sm"
                disabled={!canApply}
                title={`Apply  ${applyKeys}`.trim()}
                onClick={onApply}
                onPointerEnter={() => setIsPeeking(true)}
                onPointerLeave={() => setIsPeeking(false)}
                onFocus={() => setIsPeeking(true)}
                onBlur={() => setIsPeeking(false)}
              >
                <Check />
                {landed
                  ? `Apply ${landed} ${plural(landed, 'suggestion', 'suggestions')}`
                  : 'Apply'}
              </AppButton>
            </AppPopoverAnchor>
            <AppPopoverContent
              role="tooltip"
              side="top"
              align="end"
              sideOffset={10}
              onOpenAutoFocus={(event) => event.preventDefault()}
              className="max-h-105 w-85 overflow-auto px-3 py-2.75"
            >
              <ApplyPeek plan={plan} rows={props.rows} name={props.name} />
            </AppPopoverContent>
          </AppPopover>
        </>
      )}
    </div>
  );
}
