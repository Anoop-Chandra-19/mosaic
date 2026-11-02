import { memo, useRef, type ReactNode } from 'react';
import { LayoutTemplate, Sparkles } from 'lucide-react';
import { Text } from '@/components/ui-kit';
import { useActiveTemplate } from '@/stores/useActiveTemplate';
import { useConversationStore } from '@/stores/conversationStore';
import { useRunStore } from '@/stores/runStore';
import type { RunView } from '@/types/agentRunView';
import { describeStop } from '../notices/stopWords';
import { useServerAddresses } from '../notices/useServerAddresses';
import { addLiveRun, buildRunView } from '../run-view/buildRunView';
import { NewestButton } from './NewestButton';
import { RunActivity } from './RunActivity';
import { RunCard } from './RunCard';
import { RunRecord } from './RunRecord';
import { useMessagePages } from './useMessagePages';
import { useReturnFromTrace } from './useReturnFromTrace';
import { useStickToNewest } from './useStickToNewest';

/*
 * Renders the open conversation by run: resume switches, user requests, assistant activity
 * (`RunActivity`), and stop records (`RunRecord`, with wording from `notices/stopWords.ts`).
 * The notice above the prompt provides additional stop details. The live reply subscribes
 * to `runStore` so streaming updates rerender only that reply. Completed runs read from
 * the stored transcript.
 */

type TurnKind = 'switch' | 'ask' | 'reply';

/**
 * The space above a turn, by the one before it: a run's reply sits closer to its ask than
 * to the ask that follows it.
 */
const GAP_AFTER: Record<TurnKind, Record<TurnKind, string>> = {
  switch: { switch: 'mt-0.5', ask: '', reply: '' },
  ask: { switch: 'mt-0.5', ask: 'mt-5', reply: 'mt-3.5' },
  reply: { switch: 'mt-0.5', ask: 'mt-9.5', reply: 'mt-5' },
};

interface Turn {
  kind: TurnKind;
  run: RunView;
  isLive: boolean;
  stopRecord: string | null;
}

function TurnSpark() {
  return (
    <span className="flex size-4.75 shrink-0 items-center justify-center rounded-[0.3125rem] bg-amber-soft text-amber">
      <Sparkles className="size-2.5" />
    </span>
  );
}

function AssistantTurn({ children }: { children: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center">
        <TurnSpark />
      </div>
      {children}
    </div>
  );
}

function AskBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <Text
        as="p"
        variant="body"
        className="max-w-[90%] rounded-[0.6875rem_0.6875rem_0.1875rem_0.6875rem] border border-line bg-pane-raised px-2.75 py-2.25 wrap-break-word whitespace-pre-wrap text-foreground"
      >
        {text}
      </Text>
    </div>
  );
}

/** A fact about the conversation rather than a message: the run worked on another resume. */
function SwitchRow({ label }: { label: string }) {
  return (
    <Text
      as="p"
      variant="secondary"
      className="mb-3 flex items-center gap-2 border-y border-line px-2.5 py-1.5"
    >
      <LayoutTemplate className="size-3 shrink-0" />
      <span className="min-w-0 truncate">
        Moved to <b className="font-strong text-ink-soft">{label}</b>
      </span>
    </Text>
  );
}

/** What a stopped run's record line says; null for one that finished, or the user's Stop. */
type ReadStopRecord = (run: RunView) => string | null;

interface RunReplyProps {
  run: RunView;
  isLive: boolean;
  stopRecord: string | null;
}

/**
 * Renders the reply between any resend and stop records. Uses the same component for live
 * and stored runs so the timeline stays mounted when the run ends. Subscribes directly to
 * `runStore` so streaming updates are confined to this reply.
 */
function RunReply({ run, isLive, stopRecord }: RunReplyProps) {
  const live = useRunStore((s) => (isLive ? s.live : null));
  const startedAt = live?.startedAt ?? run.startedAt;
  const endedAt = live ? (live.endedAt ?? startedAt) : run.lastAt;
  return (
    <>
      {!isLive && run.ask === null && <RunRecord text="Sent again" at={run.startedAt} isAgain />}
      <RunActivity
        runId={run.runId}
        parts={live?.parts ?? run.parts}
        state={{
          isRunning: live !== null && !live.hasEnded,
          isStopped: live ? live.wasStopped : run.stop !== null,
          isCancelled: live ? live.wasCancelled : run.stop?.reason === 'cancelled',
        }}
        waitingSince={live?.lastEventAt ?? startedAt}
        elapsedMs={endedAt - startedAt}
        retry={live?.retrying ?? null}
        runModel={run.model}
      />
      {stopRecord !== null && run.stoppedAt !== null && (
        <RunRecord text={`Stopped: ${stopRecord}`} at={run.stoppedAt} />
      )}
      <RunCard
        runId={run.runId}
        isCancelled={live ? live.wasCancelled : run.stop?.reason === 'cancelled'}
      />
    </>
  );
}

/** A run's turns, in order; the run under way always has its reply, even before any text. */
function listRunTurns(run: RunView, isLive: boolean, readStopRecord: ReadStopRecord): Turn[] {
  const stopRecord = isLive ? null : readStopRecord(run);
  const kinds: TurnKind[] = [];
  if (run.switchedTo) kinds.push('switch');
  if (run.ask !== null) kinds.push('ask');
  if (isLive || run.parts.length > 0 || stopRecord !== null || run.ask === null) {
    kinds.push('reply');
  }
  return kinds.map((kind) => ({ kind, run, isLive, stopRecord }));
}

/**
 * Renders one turn by kind. Memoized to avoid rerendering unchanged turns each time another
 * page of older messages loads above the visible conversation.
 */
const TurnRow = memo(function TurnRow({
  kind,
  run,
  isLive,
  stopRecord,
  gapAbove,
}: Turn & { gapAbove: string }) {
  return (
    <>
      {/* Keep spacing in a separate element. Adding a margin to the top visible turn when older
          turns load would disable the browser's scroll anchoring and shift the view. */}
      {gapAbove && <div aria-hidden className={gapAbove} />}
      <div>
        {kind === 'switch' && run.switchedTo && <SwitchRow label={run.switchedTo.label} />}
        {kind === 'ask' && run.ask !== null && <AskBubble text={run.ask} />}
        {kind === 'reply' && (
          <AssistantTurn>
            <RunReply run={run} isLive={isLive} stopRecord={stopRecord} />
          </AssistantTurn>
        )}
      </div>
    </>
  );
});

function listTurns(
  runs: RunView[],
  liveRunId: number | null,
  readStopRecord: ReadStopRecord
): Turn[] {
  return addLiveRun(runs, liveRunId).flatMap((run) =>
    listRunTurns(run, run.runId === liveRunId, readStopRecord)
  );
}

function EmptyConversation() {
  const templateName = useActiveTemplate()?.name;
  return (
    <AssistantTurn>
      <Text as="p" variant="body" className="text-ink-muted text-pretty">
        {templateName && (
          <>
            New conversation on <b className="font-strong text-foreground">{templateName}</b>.{' '}
          </>
        )}
        Ask for a change in your own words. The assistant can read your resume on its own, and
        everything it wants to change comes back to you first.
      </Text>
    </AssistantTurn>
  );
}

export function AgentTranscript() {
  const conversationId = useConversationStore((s) => s.conversationId);
  const messages = useConversationStore((s) => s.messages);
  const followedRunId = useRunStore((s) =>
    s.live !== null && s.live.conversationId === conversationId ? s.live.runId : null
  );
  // Hide the live run while the loaded message window does not include the end of the log.
  const hasNewer = useConversationStore((s) => s.hasNewer);
  const liveRunId = hasNewer ? null : followedRunId;
  const scrollRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const serverAddresses = useServerAddresses();
  useStickToNewest(scrollRef, contentRef);
  useMessagePages(scrollRef);
  useReturnFromTrace(scrollRef);

  const readStopRecord = (run: RunView) =>
    run.stop && (describeStop(run.stop, run.model, serverAddresses)?.record ?? null);
  const turns = listTurns(buildRunView(messages), liveRunId, readStopRecord);
  return (
    <div className="relative flex min-h-31 flex-1 flex-col">
      <section
        ref={scrollRef}
        aria-label="Conversation"
        tabIndex={-1}
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-3.5 pt-4 pb-1.5 outline-none"
      >
        <div ref={contentRef} className="pb-2.5">
          {turns.length === 0 ? (
            <EmptyConversation />
          ) : (
            turns.map((turn, index) => (
              <TurnRow
                key={`${turn.run.runId}-${turn.kind}`}
                {...turn}
                gapAbove={index > 0 ? GAP_AFTER[turns[index - 1].kind][turn.kind] : ''}
              />
            ))
          )}
        </div>
      </section>
      <NewestButton scrollRef={scrollRef} contentRef={contentRef} />
    </div>
  );
}
