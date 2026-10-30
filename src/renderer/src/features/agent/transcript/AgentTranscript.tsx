import { useRef, type ReactNode } from 'react';
import { LayoutTemplate, Sparkles } from 'lucide-react';
import { Text } from '@/components/ui-kit';
import { useActiveTemplate } from '@/features/templates/useActiveTemplate';
import { cn } from '@/lib/utils';
import { useConversationStore } from '@/stores/conversationStore';
import { useRunStore } from '@/stores/runStore';
import type { RunPart, RunView } from '@/types/agentRunView';
import { describeStop } from '../notices/stopWords';
import { useServerAddresses } from '../notices/useServerAddresses';
import { buildRunView } from './buildRunView';
import { ReplyText } from './ReplyText';
import { RunRecord } from './RunRecord';
import { useStickToNewest } from './useStickToNewest';

/*
 * The open conversation, a run at a time: the resume it moved to, what was asked, what
 * the assistant wrote, and the record line a stop leaves (`RunRecord`, worded by
 * `notices/stopWords.ts`; the notice over the box says the rest). The run under way reads from `runStore`, so only its reply re-renders
 * as it streams; once stored, it reads from the transcript like the rest.
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
  key: string;
  kind: TurnKind;
  node: ReactNode;
}

const NO_PARTS: RunPart[] = [];

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

function LiveReply() {
  const parts = useRunStore((s) => s.live?.parts ?? NO_PARTS);
  const isWriting = useRunStore((s) => s.live !== null && !s.live.hasEnded);
  return <ReplyText parts={parts} isWriting={isWriting} />;
}

const hasText = (run: RunView) => run.parts.some((part) => part.type === 'text');

/** What a stopped run's record line says; null for one that finished, or the user's Stop. */
type ReadStopRecord = (run: RunView) => string | null;

/** The reply, between the lines a Send again and a stop leave in the run. */
function StoredReply({ run, stopRecord }: { run: RunView; stopRecord: string | null }) {
  return (
    <>
      {run.ask === null && <RunRecord text="Sent again" at={run.startedAt} isAgain />}
      {hasText(run) && <ReplyText parts={run.parts} />}
      {stopRecord !== null && run.stoppedAt !== null && (
        <RunRecord text={`Stopped: ${stopRecord}`} at={run.stoppedAt} />
      )}
    </>
  );
}

/** A run's turns, in order; the run under way always has its reply, even before any text. */
function listRunTurns(run: RunView, isLive: boolean, readStopRecord: ReadStopRecord): Turn[] {
  const turns: Turn[] = [];
  if (run.switchedTo) {
    turns.push({
      key: `${run.runId}-switch`,
      kind: 'switch',
      node: <SwitchRow label={run.switchedTo.label} />,
    });
  }
  if (run.ask !== null) {
    turns.push({ key: `${run.runId}-ask`, kind: 'ask', node: <AskBubble text={run.ask} /> });
  }
  const stopRecord = isLive ? null : readStopRecord(run);
  if (isLive || hasText(run) || stopRecord !== null || run.ask === null) {
    turns.push({
      key: `${run.runId}-reply`,
      kind: 'reply',
      node: (
        <AssistantTurn>
          {isLive ? <LiveReply /> : <StoredReply run={run} stopRecord={stopRecord} />}
        </AssistantTurn>
      ),
    });
  }
  return turns;
}

/** The stored runs, and the one under way when the transcript hasn't read it yet. */
function listTurns(
  runs: RunView[],
  liveRunId: number | null,
  readStopRecord: ReadStopRecord
): Turn[] {
  const shown =
    liveRunId === null || runs.some((run) => run.runId === liveRunId)
      ? runs
      : [
          ...runs,
          {
            runId: liveRunId,
            model: null,
            startedAt: 0,
            ask: null,
            switchedTo: null,
            parts: [],
            stop: null,
            stoppedAt: null,
          },
        ];
  return shown.flatMap((run) => listRunTurns(run, run.runId === liveRunId, readStopRecord));
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
  const liveRunId = useRunStore((s) =>
    s.live !== null && s.live.conversationId === conversationId ? s.live.runId : null
  );
  const scrollRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const serverAddresses = useServerAddresses();
  useStickToNewest(scrollRef, contentRef);

  const readStopRecord = (run: RunView) =>
    run.stop && (describeStop(run.stop, run.model, serverAddresses)?.record ?? null);
  const turns = listTurns(buildRunView(messages), liveRunId, readStopRecord);
  return (
    <section
      ref={scrollRef}
      aria-label="Conversation"
      className="min-h-31 flex-1 overflow-x-hidden overflow-y-auto px-3.5 pt-4 pb-1.5"
    >
      <div ref={contentRef} className="pb-2.5">
        {turns.length === 0 ? (
          <EmptyConversation />
        ) : (
          turns.map((turn, index) => (
            <div
              key={turn.key}
              className={cn(index > 0 && GAP_AFTER[turns[index - 1].kind][turn.kind])}
            >
              {turn.node}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
