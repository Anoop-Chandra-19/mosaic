import { useRef, useState } from 'react';
import { AppButton, Text } from '@/components/ui-kit';
import { formatCount } from '@/lib/formatCount';
import { useConversationStore } from '@/stores/conversationStore';
import { useRunStore } from '@/stores/runStore';
import { addLiveRun, buildRunView } from '../run-view/buildRunView';
import { NewestButton } from '../transcript/NewestButton';
import { useMessagePages } from '../transcript/useMessagePages';
import { useStickToNewest } from '../transcript/useStickToNewest';
import { TraceRun } from './TraceRun';
import { useOutdatedReads } from './useOutdatedReads';

/*
 * The full record of the open conversation, for whoever wants it: a tab in the pane, with the
 * page in view and the prompt box under it. It reads the same window of the log as the
 * conversation and pages it the same way. Only here: raw arguments and results, tokens,
 * attempts. Never a rev, never a key. Closed runs are a header each; one step's record is open
 * at a time, and its result is read as it opens (`ToolAnswer.tsx`).
 */

interface OpenCall {
  runId: number;
  callId: string;
}

/** The newest message knows its run's number, which is how many there are. */
function useRunCount(): number {
  return useConversationStore((s) => (s.hasNewer ? s.lastRun : s.messages).at(-1)?.runNumber ?? 0);
}

export function TraceView() {
  const conversationId = useConversationStore((s) => s.conversationId);
  const messages = useConversationStore((s) => s.messages);
  const hasNewer = useConversationStore((s) => s.hasNewer);
  const followedRunId = useRunStore((s) =>
    s.live !== null && s.live.conversationId === conversationId ? s.live.runId : null
  );
  const liveRunId = hasNewer ? null : followedRunId;
  const scrollRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  // The newest run is open until it is closed; any other, once it is opened.
  const [openedRuns, setOpenedRuns] = useState<Record<number, boolean>>({});
  const [openCall, setOpenCall] = useState<OpenCall | null>(null);
  const [isOnlyFlagged, setIsOnlyFlagged] = useState(false);
  const readOutcomes = useOutdatedReads();
  const runCount = useRunCount();
  useStickToNewest(scrollRef, contentRef);
  useMessagePages(scrollRef, isOnlyFlagged);

  const runs = addLiveRun(buildRunView(messages), liveRunId);
  const newestRunId = hasNewer ? null : (runs.at(-1)?.runId ?? null);
  const toggleRun = (runId: number) =>
    setOpenedRuns((opened) => ({
      ...opened,
      [runId]: !(opened[runId] ?? runId === newestRunId),
    }));
  const toggleCall = (runId: number, callId: string) =>
    setOpenCall((open) =>
      open?.runId === runId && open.callId === callId ? null : { runId, callId }
    );

  return (
    <div className="@container/trace relative flex min-h-31 flex-1 flex-col">
      {runCount > 0 && (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-3 py-1.75">
          <Text variant="meta">{formatCount(runCount, 'run')}</Text>
          <AppButton
            variant="filter"
            size="2xs"
            aria-pressed={isOnlyFlagged}
            onClick={() => setIsOnlyFlagged(!isOnlyFlagged)}
          >
            Only flagged
          </AppButton>
        </div>
      )}
      <section
        ref={scrollRef}
        aria-label="Trace"
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-3.5 pt-3 pb-10"
      >
        <div ref={contentRef}>
          {runs.length === 0 && (
            <Text as="p" variant="body" className="text-ink-muted text-pretty">
              Nothing here yet. What the assistant does shows here as it goes.
            </Text>
          )}
          {runs.map((run) => (
            <TraceRun
              key={run.runId}
              run={run}
              isLive={run.runId === liveRunId}
              isOpen={openedRuns[run.runId] ?? run.runId === newestRunId}
              onToggle={toggleRun}
              readOutcomes={readOutcomes[run.runId]}
              isOnlyFlagged={isOnlyFlagged}
              openCallId={openCall?.runId === run.runId ? openCall.callId : null}
              onToggleCall={toggleCall}
            />
          ))}
        </div>
      </section>
      <NewestButton scrollRef={scrollRef} contentRef={contentRef} />
    </div>
  );
}
