import { useEffect, useRef, type RefObject } from 'react';
import { AppButton, Text } from '@/components/ui-kit';
import { formatCount } from '@/lib/formatCount';
import { scrollQuietly } from '@/lib/scrollbarReveal';
import {
  clearTraceTarget,
  setOnlyFlagged,
  setRunOpen,
  toggleTraceCall,
  useAgentPaneStore,
} from '@/stores/agentPaneStore';
import { useConversationStore } from '@/stores/conversationStore';
import { useRunStore } from '@/stores/runStore';
import { addLiveRun, buildRunView } from '../run-view/buildRunView';
import { findRunAnchor, moveKeyboardTo, scrollToAnchor } from '../run-view/runAnchors';
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
 * at a time, and its result is read as it opens (`ToolAnswer.tsx`). What stays open when this
 * closes is in `agentPaneStore`, which is also how a step in the conversation links here.
 */

/** A little of what comes before the place landed on stays in view. */
const LANDS_BELOW_TOP_PX = 12;

/** The newest message knows its run's number, which is how many there are. */
function useRunCount(): number {
  return useConversationStore((s) => (s.hasNewer ? s.lastRun : s.messages).at(-1)?.runNumber ?? 0);
}

/** Brings the place a link asked for into view, and the keyboard with it. */
function useLandOnTarget(scrollRef: RefObject<HTMLElement | null>): void {
  const target = useAgentPaneStore((s) => s.traceTarget);
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller || !target) return;
    clearTraceTarget();
    const anchor = findRunAnchor(scroller, target.runId, target.callId);
    if (!anchor) {
      scrollQuietly(scroller, scroller.scrollHeight);
      return;
    }
    scrollToAnchor(scroller, anchor, LANDS_BELOW_TOP_PX);
    moveKeyboardTo(anchor);
  }, [scrollRef, target]);
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
  const openedRuns = useAgentPaneStore((s) => s.openedRuns);
  const openCall = useAgentPaneStore((s) => s.openCall);
  const isOnlyFlagged = useAgentPaneStore((s) => s.isOnlyFlagged);
  const readOutcomes = useOutdatedReads();
  const runCount = useRunCount();
  // A record loads its result as it opens, and that shouldn't carry it out of view.
  useStickToNewest(scrollRef, contentRef, openCall !== null);
  useMessagePages(scrollRef, isOnlyFlagged);
  useLandOnTarget(scrollRef);

  const runs = addLiveRun(buildRunView(messages), liveRunId);
  const newestRunId = hasNewer ? null : (runs.at(-1)?.runId ?? null);
  const toggleRun = (runId: number) =>
    setRunOpen(runId, !(openedRuns[runId] ?? runId === newestRunId));

  return (
    <div className="@container/trace relative flex min-h-31 flex-1 flex-col">
      {runCount > 0 && (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-3 py-1.75">
          <Text variant="meta">{formatCount(runCount, 'run')}</Text>
          <AppButton
            variant="filter"
            size="2xs"
            aria-pressed={isOnlyFlagged}
            onClick={() => setOnlyFlagged(!isOnlyFlagged)}
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
              onToggleCall={toggleTraceCall}
            />
          ))}
        </div>
      </section>
      <NewestButton scrollRef={scrollRef} contentRef={contentRef} />
    </div>
  );
}
