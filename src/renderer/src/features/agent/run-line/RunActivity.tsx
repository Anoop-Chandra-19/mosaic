import { Text } from '@/components/ui-kit';
import type { RunRetry } from '@/stores/runStore';
import type { RunPart } from '@/types/agentRunView';
import type { RunModel } from '@shared/types/agentConversation';
import { RetryNotice } from '../notices/RetryNotice';
import { PacedReply } from '../transcript/PacedReply';
import { TracingDots } from '../transcript/TracingDots';
import { LiveTime } from './LiveTime';
import { RunLine } from './RunLine';
import {
  describeRunAloud,
  describeRunTotal,
  isWaitingForModel,
  listRunTimeline,
  type RunState,
  type TimelineItem,
} from './runTimeline';

/*
 * What a run did and wrote, in the order it happened (`runTimeline.ts`): words never fold or
 * move, and each stretch of steps is its own line (`RunLine.tsx`). The same element shows the
 * run under way and the stored one, so ending moves nothing. This is what the transcript uses.
 */

interface RunActivityProps {
  parts: RunPart[];
  state: RunState;
  /** When the run last heard anything, which a wait for the model counts from. */
  waitingSince: number;
  elapsedMs: number;
  /** The wait before a request goes again, while there is one. */
  retry: RunRetry | null;
  runModel: RunModel | null;
}

/** A row the height of a step, the dots where its mark goes, so the first step lands in place. */
function WaitingRow({ since }: { since: number }) {
  return (
    <div className="flex min-h-6.5 items-center gap-2.25 py-1">
      <span className="grid size-3.25 shrink-0 place-items-center">
        <TracingDots />
      </span>
      <Text variant="meta" className="text-ink-faint tabular-nums">
        <LiveTime since={since} />
      </Text>
    </div>
  );
}

/** A notice that follows a line of two or more steps hangs from that line's box. */
function endsInBox(timeline: TimelineItem[]): boolean {
  const newest = timeline.at(-1);
  return newest?.kind === 'line' && newest.line.steps.length > 1;
}

export function RunActivity({
  parts,
  state,
  waitingSince,
  elapsedMs,
  retry,
  runModel,
}: RunActivityProps) {
  const timeline = listRunTimeline(parts, state);
  const isWaiting = isWaitingForModel(parts, state);
  const total = describeRunTotal(timeline, state, elapsedMs);
  if (timeline.length === 0 && !isWaiting) return null;
  return (
    <div className="mt-2.25 space-y-2.5 first:mt-0">
      <span className="sr-only" aria-live="polite">
        {describeRunAloud(timeline, state, elapsedMs)}
      </span>
      {timeline.map((item) =>
        item.kind === 'text' ? (
          <PacedReply key={item.key} text={item.text} isWriting={state.isRunning && item.isLast} />
        ) : (
          <RunLine key={item.key} line={item.line} runState={state} isLast={item.isLast} />
        )
      )}
      <RetryNotice retry={retry} runModel={runModel} isAttached={endsInBox(timeline)} />
      {isWaiting && !retry && <WaitingRow since={waitingSince} />}
      {total !== null && (
        <Text as="p" variant="meta" className="text-ink-faint tabular-nums">
          {total}
        </Text>
      )}
    </div>
  );
}
