import type { ReactNode } from 'react';
import { Check, ChevronDown, ChevronRight, SquareTerminal, X } from 'lucide-react';
import {
  AppButton,
  AppCollapsible,
  AppCollapsibleContent,
  AppCollapsibleTrigger,
  Text,
  textVariantClasses,
} from '@/components/ui-kit';
import { formatSeconds } from '@shared/time/formatTime';
import { cn } from '@/lib/utils';
import { LiveTime } from './LiveTime';
import {
  describeRunLine,
  describeThinking,
  isThinkingNow,
  isTimeShown,
  type RowState,
  type RunLineItems,
  type RunState,
  type StepRow,
  type ThinkRow,
} from './runTimeline';
import { useRunLineOpen } from './useRunLineOpen';

/*
 * One line of a run's timeline, by what it holds. Only thinking is plain words. One step is that
 * step by name, with no box, so a model that writes before every step reads as words with marks
 * in their margin. Two or more fold into a box, which opens on its own while it works.
 */

const THINKING_SHIMMER =
  'animate-thinking-shimmer bg-[linear-gradient(90deg,var(--ink-muted)_0%,var(--ink-muted)_38%,var(--foreground)_50%,var(--ink-muted)_62%,var(--ink-muted)_100%)] bg-size-[260%_100%] bg-clip-text text-transparent motion-reduce:animate-none motion-reduce:bg-none motion-reduce:text-ink-soft';

const BOX_ROW_CLASSES = 'border-t border-line px-2.75 py-1.5 first:border-t-0';

/** A line with no box, the height of a step in one. */
const BARE_LINE_CLASSES = cn(textVariantClasses('secondary'), 'min-h-6.5 py-1');

const STEP_FRAME_CLASSES = 'grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-2.25';

const BOX_STEP_TONES: Record<RowState, string> = {
  run: 'relative overflow-hidden bg-linear-to-r from-amber-soft to-transparent to-60% text-foreground before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-amber after:absolute after:inset-x-0 after:bottom-0 after:h-px after:animate-step-sweep after:bg-linear-to-r after:from-transparent after:via-amber after:to-transparent motion-reduce:after:animate-none',
  done: 'text-ink-soft',
  fail: 'text-ink-muted',
  cut: 'text-ink-faint',
};

const BARE_STEP_TONES: Record<RowState, string> = {
  run: 'text-foreground',
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

function ThinkMark({ isGoing }: { isGoing: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'mt-0.5 size-3.25 shrink-0 rounded-full border-[1.5px]',
        isGoing ? 'border-ink-faint' : 'border-dotted border-line-heavy'
      )}
    />
  );
}

function RowTime({ children, isRunning = false }: { children: ReactNode; isRunning?: boolean }) {
  return (
    <Text
      variant="meta"
      className={cn('shrink-0 pt-0.5 tabular-nums', isRunning ? 'text-amber' : 'text-ink-faint')}
    >
      {children}
    </Text>
  );
}

function StepTime({ row }: { row: StepRow }) {
  if (row.state === 'cut') return <RowTime>stopped</RowTime>;
  if (row.state === 'run') {
    if (row.startedAt === undefined) return null;
    return (
      <RowTime isRunning>
        <LiveTime since={row.startedAt} />
      </RowTime>
    );
  }
  if (row.durationMs === undefined || !isTimeShown(row.durationMs)) return null;
  return <RowTime>{formatSeconds(row.durationMs)}</RowTime>;
}

/** The note runs under the time as well: a pane is narrow, and it wraps rather than lose its end. */
function StepFrame({ row, className, time }: { row: StepRow; className: string; time: ReactNode }) {
  return (
    <div className={cn(STEP_FRAME_CLASSES, className)}>
      <StepMark state={row.state} />
      <span>{row.words}</span>
      {time}
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

function ThinkInBox({ row }: { row: ThinkRow }) {
  return (
    <div className={cn(BOX_ROW_CLASSES, 'flex items-start gap-2.25 text-ink-faint')}>
      <ThinkMark isGoing={row.state === 'run'} />
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

function ThinkingLine({ line }: { line: RunLineItems }) {
  const newest = line.rows.at(-1);
  const isGoing = isThinkingNow(line);
  return (
    <div className={cn(BARE_LINE_CLASSES, 'flex items-start gap-2.25 text-ink-faint')}>
      <ThinkMark isGoing={isGoing} />
      <span className="min-w-0 flex-1">
        {isGoing ? <span className={THINKING_SHIMMER}>Thinking</span> : describeThinking(line)}
      </span>
      {isGoing && newest?.startedAt !== undefined && (
        <RowTime isRunning>
          <LiveTime since={newest.startedAt} />
        </RowTime>
      )}
      {newest?.state === 'cut' && <RowTime>stopped</RowTime>}
    </div>
  );
}

function OneStepLine({ line, step }: { line: RunLineItems; step: StepRow }) {
  return (
    <StepFrame
      row={step}
      className={cn(BARE_LINE_CLASSES, BARE_STEP_TONES[step.state])}
      time={
        isThinkingNow(line) ? (
          <span className={THINKING_SHIMMER}>Thinking</span>
        ) : (
          <StepTime row={step} />
        )
      }
    />
  );
}

interface LineProps {
  line: RunLineItems;
  /** The run this line belongs to, which folds it when it ends. */
  runState: RunState;
  /** Nothing has come after it yet. */
  isLast: boolean;
}

function LineTime({ line, isGoing }: { line: RunLineItems; isGoing: boolean }) {
  const isCut = line.rows.some((row) => row.state === 'cut');
  return (
    <Text variant="meta" className="text-ink-faint tabular-nums">
      {isGoing && line.startedAt !== undefined && <LiveTime since={line.startedAt} prefix=" · " />}
      {!isGoing &&
        line.durationMs !== null &&
        isTimeShown(line.durationMs) &&
        ` · ${formatSeconds(line.durationMs)}`}
      {!isGoing && isCut && ' · stopped'}
    </Text>
  );
}

function BoxedLine({ line, runState, isLast }: LineProps) {
  const stepStarts = line.steps.flatMap(({ startedAt }) =>
    startedAt === undefined ? [] : [startedAt]
  );
  const { isOpen, setIsOpen } = useRunLineOpen(stepStarts, runState, !isLast);
  const isGoing = runState.isRunning && isLast;
  const label = describeRunLine(line, isGoing, isOpen);
  return (
    <AppCollapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="overflow-hidden rounded-sm border border-line"
    >
      <AppCollapsibleTrigger asChild>
        <AppButton
          variant="plain"
          className={cn(
            textVariantClasses('secondary'),
            'flex h-auto w-full items-start gap-2 px-2.25 py-1.5 text-left whitespace-normal hover:bg-line hover:text-ink-soft',
            isGoing ? 'text-ink-soft' : 'text-ink-muted'
          )}
        >
          <SquareTerminal
            aria-hidden
            className={cn(
              'mt-0.5 size-3 shrink-0',
              isGoing && !label.isThinking ? 'text-amber' : 'text-ink-faint'
            )}
          />
          <span className="min-w-0 flex-1">
            <span className={cn(label.isThinking && THINKING_SHIMMER)}>{label.text}</span>
            <LineTime line={line} isGoing={isGoing} />
          </span>
          {isOpen ? (
            <ChevronDown aria-hidden className="mt-0.5 size-3 shrink-0" />
          ) : (
            <ChevronRight aria-hidden className="mt-0.5 size-3 shrink-0" />
          )}
        </AppButton>
      </AppCollapsibleTrigger>
      <AppCollapsibleContent className="overflow-hidden duration-240 ease-settle data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down motion-reduce:animate-none">
        <div className={cn(textVariantClasses('secondary'), 'border-t border-line bg-pane-raised')}>
          {line.rows.map((row) =>
            row.kind === 'step' ? (
              <StepFrame
                key={row.key}
                row={row}
                className={cn(BOX_ROW_CLASSES, BOX_STEP_TONES[row.state])}
                time={<StepTime row={row} />}
              />
            ) : (
              <ThinkInBox key={row.key} row={row} />
            )
          )}
        </div>
      </AppCollapsibleContent>
    </AppCollapsible>
  );
}

export function RunLine({ line, runState, isLast }: LineProps) {
  const [firstStep, secondStep] = line.steps;
  if (!firstStep) return <ThinkingLine line={line} />;
  if (!secondStep) return <OneStepLine line={line} step={firstStep} />;
  return <BoxedLine line={line} runState={runState} isLast={isLast} />;
}
