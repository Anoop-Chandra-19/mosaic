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
 * Shows the open conversation's detailed record in the Trace tab, with the resume visible
 * and the prompt box below. Shares the conversation's message window and paging hooks.
 * Adds tool arguments and results, token counts, and request attempts, but no revisions or keys.
 * Collapsed runs show only headers. One tool record opens at a time and loads its result through
 * `ToolAnswer.tsx`. `agentPaneStore` preserves open records across tab switches and handles
 * links from conversation steps.
 */

/** Leaves a small gap above the target so preceding content remains visible. */
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
  // Default the newest run to open and older runs to closed, unless explicitly toggled.
  const openedRuns = useAgentPaneStore((s) => s.openedRuns);
  const openCall = useAgentPaneStore((s) => s.openCall);
  const isOnlyFlagged = useAgentPaneStore((s) => s.isOnlyFlagged);
  const readOutcomes = useOutdatedReads();
  const runCount = useRunCount();
  // Pause bottom-following while a record is open so loading its result does not move it out of view.
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
