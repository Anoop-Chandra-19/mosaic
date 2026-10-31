import type { Database } from 'better-sqlite3';
import type { RunLimitSettings } from '@shared/agent/runLimitSettings';
import type { AgentToolResult } from '@shared/agent-tools/agentTools';
import type { AgentToolCall } from '@shared/types/agentBridge';
import type { RunStopReason, ToolTarget } from '@shared/types/agentConversation';
import type { AgentRunEvent } from '@shared/types/agentRunEvents';
import type { ModelReplyPart } from '@shared/types/modelReply';
import { storeToolAnswers } from '../db/conversations/runLog';
import type { ConversationRun } from '../db/conversations/runs';
import type { ToolCallEnd } from '../db/conversations/toolCalls';
import { ABORTED, untilAborted } from './abortableWaits';
import type { DraftStamp } from './assembleModelContext';
import type { RunLimits } from './runLimits';

/*
 * One step's tool round: each call the model made, in order, sent to the page that runs
 * the tools, its answer counted by the stop layers, and every answer stored as one
 * message, so no call is ever left without its result.
 */

export type ToolCallPart = Extract<ModelReplyPart, { type: 'toolCall' }>;

/**
 * How main reaches the page that runs the tools. A call can't be cancelled across IPC;
 * on a Stop or a timeout the round stops waiting, and a late answer is dropped.
 */
export interface ToolBridge {
  runTool(call: AgentToolCall): Promise<AgentToolResult>;
}

export interface ToolRound {
  db: Database;
  run: ConversationRun;
  calls: ToolCallPart[];
  /** When each call began, which its time on the run line counts from. */
  callStartedAt: ReadonlyMap<string, number>;
  bridge: ToolBridge;
  signal: AbortSignal;
  limits: RunLimits;
  settings: RunLimitSettings;
  draft: DraftStamp | null;
  onEvent: (event: AgentRunEvent) => void;
}

export interface ToolRoundEnd {
  /** The draft as the last answer found it. */
  draft: DraftStamp | null;
  stop?: { reason: RunStopReason; detail: string };
}

interface CallOutcome {
  content: string;
  isError: boolean;
  status: ToolCallEnd['status'];
  checkName?: string;
  draft: DraftStamp | null;
  target?: ToolTarget;
  durationMs?: number;
  startedAt?: number;
}

const NOT_RUN: Record<'cancelled' | 'stopped', string> = {
  cancelled: 'Not run: the user stopped the run.',
  stopped: 'Not run: the run stopped.',
};

const notRun = (why: keyof typeof NOT_RUN, draft: DraftStamp | null): CallOutcome => ({
  content: NOT_RUN[why],
  isError: true,
  status: 'cancelled',
  checkName: why,
  draft,
});

/** The page's answer, or a failure in its place: a call always gets one. */
async function askPage(round: ToolRound, call: ToolCallPart): Promise<CallOutcome> {
  const { bridge, signal, settings, draft } = round;
  const request = { runId: round.run.runId, callId: call.callId, name: call.name, args: call.args };
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(settings.toolAnswerMs)]);
  try {
    const answer = await untilAborted(bridge.runTool(request), deadline);
    if (answer === ABORTED && signal.aborted) return notRun('cancelled', draft);
    if (answer === ABORTED) {
      return {
        content: 'The tool did not answer in time.',
        isError: true,
        status: 'error',
        checkName: 'timeout',
        draft,
      };
    }
    return {
      content: answer.content,
      isError: answer.isError,
      status: answer.isError ? 'error' : 'ok',
      draft: answer.draft,
      target: answer.target,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { content: `The tool failed: ${message}`, isError: true, status: 'error', draft };
  }
}

export async function runToolRound(round: ToolRound): Promise<ToolRoundEnd> {
  const { calls, signal, limits, onEvent } = round;
  let draft = round.draft;
  let stop: ToolRoundEnd['stop'];
  const outcomes: CallOutcome[] = [];

  for (const call of calls) {
    if (signal.aborted || stop) {
      outcomes.push(notRun(signal.aborted ? 'cancelled' : 'stopped', draft));
      continue;
    }
    const outcome = await askPage({ ...round, draft }, call);
    if (outcome.status !== 'cancelled') {
      const verdict = limits.noteAnswer(call.name, call.args, outcome);
      outcome.content = verdict.content;
      stop = verdict.stop;
      const startedAt = round.callStartedAt.get(call.callId);
      if (startedAt !== undefined) {
        outcome.startedAt = startedAt;
        outcome.durationMs = Math.max(0, Date.now() - startedAt);
      }
      onEvent({
        type: 'toolResult',
        callId: call.callId,
        isError: outcome.isError,
        target: outcome.target,
        durationMs: outcome.durationMs,
        startedAt: outcome.startedAt,
      });
    }
    draft = outcome.draft;
    outcomes.push(outcome);
  }
  stop ??= limits.noteStep(outcomes.filter((outcome) => outcome.status !== 'cancelled'));

  storeToolAnswers(
    round.db,
    round.run,
    outcomes.map(({ draft: answered, ...outcome }, index) => ({
      ...outcome,
      callId: calls[index].callId,
      rev: answered?.rev ?? null,
    }))
  );
  return { draft, stop };
}
