import { memo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { AppButton, Chip, Text, textVariantClasses } from '@/components/ui-kit';
import { cn } from '@/lib/utils';
import { useRunStore } from '@/stores/runStore';
import type { RunView } from '@/types/agentRunView';
import { formatTimeOfDay } from '@shared/time/formatTime';
import { QuotedBlock } from '../notices/AgentNotice';
import { RetryNotice } from '../notices/RetryNotice';
import { quoteProviderError, readRunSource } from '../notices/runSource';
import { describeStop } from '../notices/stopWords';
import { useServerAddresses } from '../notices/useServerAddresses';
import { LiveTime } from '../run-view/LiveTime';
import { runAnchorProps } from '../run-view/runAnchors';
import { ThinkMark } from '../run-view/RunLine';
import {
  countRunSteps,
  countSteps,
  listRunTimeline,
  type RunLineItems,
  type RunState,
  type ThinkRow,
} from '../run-view/runTimeline';
import { countFlaggedSteps, isStepFlagged } from './traceFlags';
import { TraceStep } from './TraceStep';
import { describeRetry, formatThinkingLength, formatTokens, formatTraceTime } from './traceWords';
import type { ReadOutcomes } from './useOutdatedReads';

/*
 * One run in the Trace: a header that says what was asked and what it came to, and, open, the
 * same order and the same split as the conversation. Its words are short excerpts, as the
 * conversation has them in full. A closed run draws only its header, so a long conversation
 * costs a list of headers.
 */

function ThinkEntry({ row }: { row: ThinkRow }) {
  return (
    <div
      className={cn(
        textVariantClasses('secondary'),
        'flex items-center gap-2 border-t border-line px-1 py-1.5 text-ink-faint first:border-t-0'
      )}
    >
      <ThinkMark isGoing={row.state === 'run'} />
      <span className={row.state === 'run' ? 'text-ink-soft' : undefined}>
        {row.state === 'run' ? 'Thinking' : 'Thought'}
      </span>
      {row.textLength !== undefined && (
        <Text variant="caption" className="min-w-0 truncate">
          {formatThinkingLength(row.textLength)}
        </Text>
      )}
      {row.durationMs !== null && (
        <Text variant="meta" className="ml-auto shrink-0">
          {formatTraceTime(row.durationMs)}
        </Text>
      )}
    </div>
  );
}

interface TraceLineProps {
  line: RunLineItems;
  run: RunView;
  readOutcomes: ReadOutcomes | undefined;
  isOnlyFlagged: boolean;
  openCallId: string | null;
  onToggleCall: (callId: string) => void;
}

/** A line of the conversation, drawn as a bracket on the left. */
function TraceLine({
  line,
  run,
  readOutcomes,
  isOnlyFlagged,
  openCallId,
  onToggleCall,
}: TraceLineProps) {
  // A record open stays, whatever the filter: a link from the conversation may have opened it.
  const rows = isOnlyFlagged
    ? line.rows.filter(
        (row) =>
          row.kind === 'step' &&
          (row.key === openCallId || isStepFlagged(row, readOutcomes?.[row.key]))
      )
    : line.rows;
  if (rows.length === 0) return null;
  return (
    <div className="flex flex-col border-l-2 border-line-strong pl-2.5">
      {line.steps.length > 1 && (
        <Text as="p" variant="meta" className="pb-0.75">
          {countSteps(line.steps.length)}
        </Text>
      )}
      {rows.map((row) =>
        row.kind === 'think' ? (
          <ThinkEntry key={row.key} row={row} />
        ) : (
          <TraceStep
            key={row.key}
            runId={run.runId}
            row={row}
            model={run.model}
            readOutcome={readOutcomes?.[row.key]}
            isOpen={openCallId === row.key}
            onToggle={() => onToggleCall(row.key)}
          />
        )
      )}
    </div>
  );
}

/** Words the model wrote, two lines of them in their place; a press shows the rest. */
function TraceWords({ text }: { text: string }) {
  const [isWhole, setIsWhole] = useState(false);
  return (
    <AppButton
      variant="plain"
      aria-expanded={isWhole}
      onClick={() => setIsWhole(!isWhole)}
      className="flex h-auto w-full items-baseline gap-2.5 py-0.5 pr-1 pl-3 text-left font-regular whitespace-normal"
    >
      <Text variant="caption" className="w-10 shrink-0">
        Wrote
      </Text>
      <Text
        variant="secondary"
        className={cn('min-w-0 flex-1 wrap-break-word text-pretty', !isWhole && 'line-clamp-2')}
      >
        {text}
      </Text>
    </AppButton>
  );
}

/** How a stopped run ended, with what the provider said and the requests that failed first. */
function TraceStop({ run }: { run: RunView }) {
  const serverAddresses = useServerAddresses();
  const { stop } = run;
  if (!stop) return null;
  const words = describeStop(stop, run.model, serverAddresses);
  const { provider } = readRunSource(run.model, serverAddresses);
  const quoted = stop.providerError && quoteProviderError(stop.providerError, provider);
  return (
    <div>
      <Text as="p" variant="caption" className="pl-3">
        {stop.reason === 'cancelled'
          ? 'Stopped by you'
          : `Stopped: ${words?.record ?? stop.reason}`}
      </Text>
      {stop.retries?.map((retry, index) => (
        <Text as="p" variant="caption" key={index} className="pl-3 wrap-anywhere">
          Attempt {index + 1}: {describeRetry(retry)}
        </Text>
      ))}
      {quoted && <QuotedBlock quoted={quoted} />}
    </div>
  );
}

interface TraceRunProps {
  run: RunView;
  isLive: boolean;
  isOpen: boolean;
  onToggle: (runId: number) => void;
  readOutcomes: ReadOutcomes | undefined;
  isOnlyFlagged: boolean;
  openCallId: string | null;
  onToggleCall: (runId: number, callId: string) => void;
}

/** Memoized by hand, as a transcript turn is: older pages land above in pieces. */
export const TraceRun = memo(function TraceRun({
  run,
  isLive,
  isOpen,
  onToggle,
  readOutcomes,
  isOnlyFlagged,
  openCallId,
  onToggleCall,
}: TraceRunProps) {
  const live = useRunStore((s) => (isLive ? s.live : null));
  const startedAt = live?.startedAt ?? run.startedAt;
  const isRunning = live !== null && !live.hasEnded;
  const state: RunState = {
    isRunning,
    isStopped: live ? live.wasStopped : run.stop !== null,
    isCancelled: live ? live.wasCancelled : run.stop?.reason === 'cancelled',
  };
  const timeline = listRunTimeline(live?.parts ?? run.parts, state);
  const steps = countSteps(countRunSteps(timeline, state));
  const endedAt = live ? (live.endedAt ?? startedAt) : run.lastAt;
  const flagged = countFlaggedSteps(timeline, readOutcomes);
  return (
    <section className="border-t border-line pt-2 pb-2.5 first:border-t-0">
      <AppButton
        variant="plain"
        aria-expanded={isOpen}
        onClick={() => onToggle(run.runId)}
        {...runAnchorProps(run.runId)}
        className={cn(
          textVariantClasses('secondary'),
          '-mx-1 flex h-auto w-[calc(100%+0.5rem)] flex-col items-stretch gap-0.5 rounded-sm px-1 py-0.75 text-left text-ink-muted hover:bg-line'
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          {isOpen ? (
            <ChevronDown aria-hidden className="size-3 shrink-0" />
          ) : (
            <ChevronRight aria-hidden className="size-3 shrink-0" />
          )}
          <span className="shrink-0 font-strong text-foreground">
            {run.number === undefined ? 'This run' : `Run ${run.number}`}
          </span>
          <span className="min-w-0 flex-1 truncate font-regular text-ink-soft">
            {run.ask ?? 'Sent again'}
          </span>
          {startedAt > 0 && (
            <Text variant="meta" className="shrink-0">
              {formatTimeOfDay(startedAt)}
            </Text>
          )}
        </span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-5">
          {isRunning ? (
            <Text variant="meta" className="text-amber">
              Running · {steps}
              <LiveTime since={startedAt} prefix=" · " />
            </Text>
          ) : (
            <Text variant="meta">
              {steps} · {formatTraceTime(endedAt - startedAt)}
            </Text>
          )}
          {run.model && <Text variant="meta">{run.model.model}</Text>}
          {run.usage && <Text variant="meta">{formatTokens(run.usage)}</Text>}
          {flagged > 0 && (
            <Chip size="sm" tone="warn">
              {flagged} flagged
            </Chip>
          )}
        </span>
      </AppButton>
      {isOpen && (
        <div className="flex flex-col gap-2 pt-2.5 pl-5 @max-[27.5rem]/trace:pl-2">
          {isOnlyFlagged && flagged === 0 && (
            <Text as="p" variant="caption">
              Nothing flagged in this run.
            </Text>
          )}
          {timeline.map((item) =>
            item.kind === 'text' ? (
              !isOnlyFlagged && <TraceWords key={item.key} text={item.text} />
            ) : (
              <TraceLine
                key={item.key}
                line={item.line}
                run={run}
                readOutcomes={readOutcomes}
                isOnlyFlagged={isOnlyFlagged}
                openCallId={openCallId}
                onToggleCall={(callId) => onToggleCall(run.runId, callId)}
              />
            )
          )}
          {live && <RetryNotice retry={live.retrying} runModel={run.model} isAttached={false} />}
          <TraceStop run={run} />
        </div>
      )}
    </section>
  );
});
