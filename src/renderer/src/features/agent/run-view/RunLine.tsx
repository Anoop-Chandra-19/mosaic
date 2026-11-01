import { useEffect, type ReactNode } from 'react';
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
import { isSameCall, showInTrace, useAgentPaneStore } from '@/stores/agentPaneStore';
import { LiveTime } from './LiveTime';
import { runAnchorProps } from './runAnchors';
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
 * in their margin. Two or more fold into a box, which opens on its own while it works. Every step
 * links to its record in the Trace, and is marked while that record is open.
 */

const THINKING_SHIMMER =
  'animate-thinking-shimmer bg-[linear-gradient(90deg,var(--ink-muted)_0%,var(--ink-muted)_38%,var(--foreground)_50%,var(--ink-muted)_62%,var(--ink-muted)_100%)] bg-size-[260%_100%] bg-clip-text text-transparent motion-reduce:animate-none motion-reduce:bg-none motion-reduce:text-ink-soft';

const BOX_ROW_CLASSES = 'border-t border-line px-2.75 py-1.5 first:border-t-0';

/** A line with no box, the height of a step in one. */
const BARE_LINE_CLASSES = cn(textVariantClasses('secondary'), 'min-h-6.5 py-1');

/** Its fill reaches past the text, which stays in line with the words around it. */
const BARE_STEP_ROW_CLASSES = '-mx-1.5 w-[calc(100%+0.75rem)] rounded-sm px-1.5 hover:bg-line';

const STEP_FRAME_CLASSES = cn(
  textVariantClasses('secondary'),
  'group grid h-auto w-full grid-cols-[auto_minmax(0,1fr)_auto_auto] items-start gap-x-2.25 text-left font-regular whitespace-normal'
);

/** Neutral: amber stays for what is under way. */
const MARKED_STEP_CLASSES = 'bg-line ring-1 ring-line-heavy ring-inset';

const BOX_STEP_TONES: Record<RowState, string> = {
  run: 'relative overflow-hidden bg-linear-to-r from-amber-soft to-transparent to-60% text-foreground before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-amber after:absolute after:inset-x-0 after:bottom-0 after:h-px after:animate-step-sweep after:bg-linear-to-r after:from-transparent after:via-amber after:to-transparent motion-reduce:after:animate-none',
  wait: 'text-ink-soft',
  done: 'text-ink-soft',
  fail: 'text-ink-muted',
  cut: 'text-ink-faint',
};

const BARE_STEP_TONES: Record<RowState, string> = {
  run: 'text-foreground',
  wait: 'text-ink-soft',
  done: 'text-ink-soft',
  fail: 'text-ink-muted',
  cut: 'text-ink-faint',
};

const MARK_TONES: Record<RowState, string> = {
  run: 'border-transparent text-amber',
  wait: 'border-line-heavy',
  done: 'border-add bg-add text-background',
  fail: 'border-warn bg-warn text-background',
  cut: 'border-dashed border-line-heavy',
};

export function StepMark({ state }: { state: RowState }) {
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

export function ThinkMark({ isGoing }: { isGoing: boolean }) {
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
  if (row.state === 'wait') return null;
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

interface StepFrameProps {
  runId: number;
  row: StepRow;
  className: string;
  time: ReactNode;
}

/** The note runs under the time as well: a pane is narrow, and it wraps rather than lose its end. */
function StepFrame({ runId, row, className, time }: StepFrameProps) {
  const isMarked = useAgentPaneStore((s) => isSameCall(s.openCall, runId, row.key));
  return (
    <AppButton
      variant="plain"
      onClick={() => showInTrace({ runId, callId: row.key })}
      {...runAnchorProps(runId, row.key)}
      className={cn(STEP_FRAME_CLASSES, className, isMarked && MARKED_STEP_CLASSES)}
    >
      <StepMark state={row.state} />
      <span>{row.words}</span>
      {time}
      <ChevronRight
        aria-hidden
        className="invisible col-start-4 row-start-1 mt-0.5 size-3 text-ink-muted group-hover:visible group-focus-visible:visible"
      />
      {row.note && (
        <Text
          variant="meta"
          className={cn(
            'col-span-3 col-start-2 mt-0.5 wrap-break-word',
            row.state === 'fail' ? 'text-warn' : 'text-ink-faint'
          )}
        >
          {row.note}
        </Text>
      )}
    </AppButton>
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

function OneStepLine({ runId, line, step }: { runId: number; line: RunLineItems; step: StepRow }) {
  return (
    <StepFrame
      runId={runId}
      row={step}
      className={cn(BARE_LINE_CLASSES, BARE_STEP_ROW_CLASSES, BARE_STEP_TONES[step.state])}
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
  runId: number;
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

function BoxedLine({ runId, line, runState, isLast }: LineProps) {
  const stepStarts = line.steps.flatMap(({ startedAt }) =>
    startedAt === undefined ? [] : [startedAt]
  );
  const { isOpen, setIsOpen } = useRunLineOpen(stepStarts, runState, !isLast);
  const holdsMarked = useAgentPaneStore((s) =>
    line.steps.some((step) => isSameCall(s.openCall, runId, step.key))
  );
  // A record opened in the Trace may be a step folded away here: coming back needs it to land on.
  useEffect(() => {
    if (holdsMarked) setIsOpen(true);
  }, [holdsMarked, setIsOpen]);
  const isGoing = runState.isRunning && isLast;
  const label = describeRunLine(line, isGoing, isOpen);
  return (
    <AppCollapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className={cn(
        'overflow-hidden rounded-sm border',
        holdsMarked ? 'border-line-heavy' : 'border-line'
      )}
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
                runId={runId}
                row={row}
                className={cn(
                  BOX_ROW_CLASSES,
                  'rounded-none hover:bg-line',
                  BOX_STEP_TONES[row.state]
                )}
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

export function RunLine({ runId, line, runState, isLast }: LineProps) {
  const [firstStep, secondStep] = line.steps;
  if (!firstStep) return <ThinkingLine line={line} />;
  if (!secondStep) return <OneStepLine runId={runId} line={line} step={firstStep} />;
  return <BoxedLine runId={runId} line={line} runState={runState} isLast={isLast} />;
}
