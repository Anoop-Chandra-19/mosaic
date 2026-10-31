import { Check, ChevronDown, ChevronRight, SquareTerminal, X } from 'lucide-react';
import {
  AppButton,
  AppCollapsible,
  AppCollapsibleContent,
  AppCollapsibleTrigger,
  Text,
  textVariantClasses,
} from '@/components/ui-kit';
import { cn } from '@/lib/utils';
import { ReplyMarkdown } from '../transcript/ReplyMarkdown';
import { LiveTime } from './LiveTime';
import {
  describeRunLine,
  formatSeconds,
  isTimeShown,
  type RowState,
  type RunLineItems,
  type RunLineRow,
  type RunState,
} from './runLineItems';

/*
 * The run line: one element for every run length. It is absent with no steps or thinking,
 * one line for a short run, and the same line opening in place into its rows for a long one,
 * so finishing a run moves nothing. Screen readers hear the start and the end only.
 */

const THINKING_SHIMMER =
  'animate-thinking-shimmer bg-[linear-gradient(90deg,var(--ink-muted)_0%,var(--ink-muted)_38%,var(--foreground)_50%,var(--ink-muted)_62%,var(--ink-muted)_100%)] bg-size-[260%_100%] bg-clip-text text-transparent motion-reduce:animate-none motion-reduce:bg-none motion-reduce:text-ink-soft';

const STEP_ROW_CLASSES = 'border-t border-line px-2.75 py-1.5 first:border-t-0';
const ROW_CLASSES = cn(STEP_ROW_CLASSES, 'flex items-start gap-2.25');

const STEP_TONES: Record<RowState, string> = {
  run: 'relative overflow-hidden bg-linear-to-r from-amber-soft to-transparent to-60% text-foreground before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-amber after:absolute after:inset-x-0 after:bottom-0 after:h-px after:animate-step-sweep after:bg-linear-to-r after:from-transparent after:via-amber after:to-transparent motion-reduce:after:animate-none',
  done: 'text-ink-soft',
  fail: 'text-ink-muted',
  cut: 'text-ink-faint',
};

const MARK_TONES: Record<RowState, string> = {
  run: 'border-transparent text-amber',
  done: 'border-add bg-add text-background',
  fail: 'border-warn bg-warn text-background',
  cut: 'border-dashed border-line-heavy',
};

function StepMark({ state }: { state: RowState }) {
  return (
    <span
      aria-hidden
      className={cn(
        'mt-0.5 grid size-3.25 shrink-0 place-items-center rounded-full border-[1.5px]',
        MARK_TONES[state]
      )}
    >
      {state === 'done' && <Check className="size-2" strokeWidth={3.4} />}
      {state === 'fail' && <X className="size-2" strokeWidth={3.4} />}
      {state === 'run' && <ChevronRight className="size-2.25" strokeWidth={3} />}
    </span>
  );
}

function RowTime({
  children,
  isRunning = false,
}: {
  children: React.ReactNode;
  isRunning?: boolean;
}) {
  return (
    <Text
      variant="meta"
      className={cn('shrink-0 pt-0.5 tabular-nums', isRunning ? 'text-amber' : 'text-ink-faint')}
    >
      {children}
    </Text>
  );
}

/** The note runs under the time as well: a pane is narrow, and it wraps rather than lose its end. */
function StepRow({ row }: { row: Extract<RunLineRow, { kind: 'step' }> }) {
  return (
    <div
      className={cn(
        STEP_ROW_CLASSES,
        'grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-2.25',
        STEP_TONES[row.state]
      )}
    >
      <StepMark state={row.state} />
      <span>{row.words}</span>
      {row.state === 'run' && row.startedAt !== undefined && (
        <RowTime isRunning>
          <LiveTime since={row.startedAt} />
        </RowTime>
      )}
      {(row.state === 'done' || row.state === 'fail') &&
        row.durationMs !== undefined &&
        isTimeShown(row.durationMs) && <RowTime>{formatSeconds(row.durationMs)}</RowTime>}
      {row.state === 'cut' && <RowTime>stopped</RowTime>}
      {row.note && (
        <Text
          variant="meta"
          className={cn(
            'col-span-2 col-start-2 mt-0.5 wrap-break-word',
            row.state === 'fail' ? 'text-warn' : 'text-ink-faint'
          )}
        >
          {row.note}
        </Text>
      )}
    </div>
  );
}

function ThinkRow({ row }: { row: Extract<RunLineRow, { kind: 'think' }> }) {
  return (
    <div className={cn(ROW_CLASSES, 'text-ink-faint')}>
      <span
        aria-hidden
        className={cn(
          'mt-0.5 size-3.25 shrink-0 rounded-full border-[1.5px]',
          row.state === 'run' ? 'border-ink-faint' : 'border-dotted border-line-heavy'
        )}
      />
      <span className="min-w-0 flex-1">
        {row.state === 'run' ? <span className={THINKING_SHIMMER}>Thinking</span> : 'Thought'}
      </span>
      {row.state === 'run' && row.startedAt !== undefined && (
        <RowTime isRunning>
          <LiveTime since={row.startedAt} />
        </RowTime>
      )}
      {row.state === 'done' && row.durationMs !== null && (
        <RowTime>{formatSeconds(row.durationMs)}</RowTime>
      )}
      {row.state === 'cut' && <RowTime>stopped</RowTime>}
    </div>
  );
}

function SaidBetween({ text }: { text: string }) {
  return (
    <div className="border-t border-line px-2.75 pt-2.25 pb-2 text-ink-soft first:border-t-0">
      <ReplyMarkdown text={text} variant="secondary" />
    </div>
  );
}

const ROW_BY_KIND = {
  step: StepRow,
  think: ThinkRow,
} as const;

function Row({ row }: { row: RunLineRow }) {
  if (row.kind === 'text') return <SaidBetween text={row.text} />;
  const Listed = ROW_BY_KIND[row.kind] as (props: { row: RunLineRow }) => React.ReactNode;
  return <Listed row={row} />;
}

interface RunLineProps {
  items: RunLineItems;
  state: RunState;
  /** When the run began, which a running line's time climbs from. */
  startedAt: number;
  /** How long a finished run took. */
  elapsedMs: number;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

const HEADER_CLASSES = cn(
  textVariantClasses('secondary'),
  'flex w-full items-start gap-2 px-2.25 py-1.5 text-left'
);

export function RunLine({
  items,
  state,
  startedAt,
  elapsedMs,
  isOpen,
  onOpenChange,
}: RunLineProps) {
  const hasSteps = items.stepCount > 0;
  const isShownOpen = isOpen && hasSteps;
  const label = describeRunLine(items, state, isShownOpen, elapsedMs);
  const contents = (
    <>
      <SquareTerminal
        aria-hidden
        className={cn(
          'mt-0.5 size-3 shrink-0',
          state.isRunning && !label.isThinking ? 'text-amber' : 'text-ink-faint'
        )}
      />
      <span className="min-w-0 flex-1">
        <span className={cn(label.isThinking && THINKING_SHIMMER)}>{label.text}</span>
        <Text variant="meta" className="text-ink-faint tabular-nums">
          {label.showsTime && state.isRunning && <LiveTime since={startedAt} prefix=" · " />}
          {label.showsTime &&
            !state.isRunning &&
            isTimeShown(elapsedMs) &&
            ` · ${formatSeconds(elapsedMs)}`}
          {!state.isRunning && state.isStopped && ' · stopped'}
        </Text>
      </span>
      {hasSteps &&
        (isShownOpen ? (
          <ChevronDown aria-hidden className="mt-0.5 size-3 shrink-0" />
        ) : (
          <ChevronRight aria-hidden className="mt-0.5 size-3 shrink-0" />
        ))}
    </>
  );

  return (
    <AppCollapsible
      open={isShownOpen}
      onOpenChange={onOpenChange}
      className="overflow-hidden rounded-sm border border-line"
    >
      <span className="sr-only" aria-live="polite">
        {label.spoken}
      </span>
      {hasSteps ? (
        <AppCollapsibleTrigger asChild>
          <AppButton
            variant="plain"
            className={cn(
              HEADER_CLASSES,
              'h-auto whitespace-normal hover:bg-line hover:text-ink-soft',
              state.isRunning ? 'text-ink-soft' : 'text-ink-muted'
            )}
          >
            {contents}
          </AppButton>
        </AppCollapsibleTrigger>
      ) : (
        <div className={cn(HEADER_CLASSES, state.isRunning ? 'text-ink-soft' : 'text-ink-muted')}>
          {contents}
        </div>
      )}
      <AppCollapsibleContent className="overflow-hidden duration-240 ease-settle data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down motion-reduce:animate-none">
        <div className={cn(textVariantClasses('secondary'), 'border-t border-line bg-pane-raised')}>
          {items.rows.map((row) => (
            <Row key={row.key} row={row} />
          ))}
        </div>
      </AppCollapsibleContent>
    </AppCollapsible>
  );
}
