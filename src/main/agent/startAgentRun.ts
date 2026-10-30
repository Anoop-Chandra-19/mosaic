import type { Database } from 'better-sqlite3';
import { RUN_LIMITS, type RunLimitSettings } from '@shared/agent/runLimitSettings';
import { AGENT_TOOLS } from '@shared/agent-tools/agentTools';
import type { RunStopReason } from '@shared/types/agentConversation';
import type { AgentRunEvent } from '@shared/types/agentRunEvents';
import type { ModelProviderError, ModelUsage } from '@shared/types/modelReply';
import { readConversationLog } from '../db/conversations/messages';
import {
  endRun,
  failRun,
  startCarryOnRun,
  startUserRun,
  storeModelReply,
  type RunStop,
} from '../db/conversations/runLog';
import type { ConversationRun } from '../db/conversations/runs';
import { readToolCallStamps } from '../db/conversations/toolCalls';
import type { ModelProvider } from '../model-providers/modelProvider';
import { assembleModelContext, type DraftStamp } from './assembleModelContext';
import { buildSystemPrompt } from './buildSystemPrompt';
import { waitUnlessAborted, type Wait } from './abortableWaits';
import { requestModelReply } from './requestModelReply';
import { createRunLimits } from './runLimits';
import { runToolRound, type ToolBridge, type ToolCallPart } from './runToolRound';

/*
 * One run of the assistant, in main. `startAgentRun` starts a run on a conversation, for
 * the user's message or to carry on, then loops a step at a time: the context built from
 * the log (`assembleModelContext.ts`), one request to the model (`requestModelReply.ts`,
 * which retries a failed connection), its reply stored, its tool calls answered by the
 * page through a `ToolBridge` (`runToolRound.ts`). A reply with no tool calls ends the
 * run; so does a stop layer (`runLimits.ts`), a provider failure or the user's Stop, each
 * written as a `runStopped` message, with what was staged kept. `agentRuns.ts` starts runs
 * through this file; tests use it directly.
 */

/**
 * What the user sent, in a new conversation (`conversationId` null) or an old one; or carry
 * on from a conversation's log with no new message.
 */
export type AgentAsk =
  | { type: 'user'; conversationId: number | null; text: string }
  | { type: 'carryOn'; conversationId: number };

export interface AgentRunRequest {
  db: Database;
  ask: AgentAsk;
  /** The template open when the user sent it; null with none open. */
  templateId: string | null;
  model: { provider: string; name: string };
  modelProvider: ModelProvider;
  bridge: ToolBridge;
  signal: AbortSignal;
  /** Each event comes with its run, since the first arrives before `startAgentRun` returns. */
  onEvent?: (event: AgentRunEvent, run: ConversationRun) => void;
  limits?: RunLimitSettings;
  wait?: Wait;
}

export interface AgentRunEnd {
  /** Absent when the model finished. */
  stopReason?: RunStopReason;
  /** Why the provider turned the run down, when it did. */
  providerErrorReason?: ModelProviderError['reason'];
}

/** A run stored as started; `ended` settles once its end is stored too. */
export interface StartedAgentRun extends ConversationRun {
  ended: Promise<AgentRunEnd>;
}

interface StartedRun extends ConversationRun {
  draft: DraftStamp | null;
  resumeName: string | null;
}

function beginRun({ db, ask, templateId, model }: AgentRunRequest): StartedRun {
  const choice = { templateId, provider: model.provider, model: model.name };
  const { conversationId, runId, template } =
    ask.type === 'user'
      ? startUserRun(db, { ...choice, conversationId: ask.conversationId, text: ask.text })
      : startCarryOnRun(db, { ...choice, conversationId: ask.conversationId });
  return {
    conversationId,
    runId,
    draft: template && { templateId: template.id, rev: template.rev },
    resumeName: template?.name ?? null,
  };
}

/** Tokens over the run's steps; null until a provider reports any. */
type RunUsage = { total: ModelUsage | null };

/** Absent while no step has said: unknown, not zero. */
function addCount(total: number | undefined, step: number | undefined): number | undefined {
  return total === undefined && step === undefined ? undefined : (total ?? 0) + (step ?? 0);
}

function addUsage(usage: RunUsage, step: ModelUsage | null): void {
  if (!step) return;
  usage.total = {
    inputTokens: (usage.total?.inputTokens ?? 0) + step.inputTokens,
    outputTokens: (usage.total?.outputTokens ?? 0) + step.outputTokens,
    cachedInputTokens: addCount(usage.total?.cachedInputTokens, step.cachedInputTokens),
  };
}

/** Steps until the model finishes or something stops the run. */
async function loopSteps(
  request: AgentRunRequest,
  run: StartedRun,
  usage: RunUsage
): Promise<RunStop | undefined> {
  const { db, modelProvider, bridge, signal } = request;
  const { conversationId } = run;
  const modelName = request.model.name;
  const onEvent = (event: AgentRunEvent) => request.onEvent?.(event, run);
  const limitSettings = request.limits ?? RUN_LIMITS;
  const limits = createRunLimits(limitSettings);
  const system = buildSystemPrompt(run.resumeName);
  const tools = Object.values(AGENT_TOOLS);
  const cacheKey = `mosaic-conversation-${conversationId}`;
  let draft = run.draft;

  for (let step = 1; ; step++) {
    onEvent({ type: 'stepStarted', step });
    const messages = assembleModelContext(
      readConversationLog(db, conversationId),
      readToolCallStamps(db, conversationId),
      draft
    );
    const reply = await requestModelReply({
      provider: modelProvider,
      request: { model: modelName, system, messages, tools, cacheKey },
      signal,
      onEvent,
      limits: limitSettings,
      wait: request.wait ?? waitUnlessAborted,
    });
    if (!reply.ok && reply.reason === 'cancelled') {
      // What streamed before the Stop is kept, without calls that will never be answered.
      const kept = reply.parts.filter((part) => part.type !== 'toolCall');
      if (kept.length > 0) storeModelReply(db, run, { parts: kept, model: modelName, rev: null });
      return { reason: 'cancelled' };
    }
    if (!reply.ok) {
      const { reason, error, attempts, waitedMs } = reply;
      return { reason, providerError: error, attempts, waitedMs };
    }

    addUsage(usage, reply.usage);
    const { parts, finish } = reply;
    storeModelReply(db, run, {
      parts,
      finish,
      usage: reply.usage,
      model: modelName,
      rev: draft?.rev ?? null,
    });
    const calls = reply.parts.filter((part): part is ToolCallPart => part.type === 'toolCall');
    if (calls.length === 0) return undefined;

    const round = await runToolRound({
      db,
      run,
      calls,
      bridge,
      signal,
      limits,
      settings: limitSettings,
      draft,
      onEvent,
    });
    draft = round.draft;
    if (round.stop) return round.stop;
    if (signal.aborted) return { reason: 'cancelled' };
    if (step >= limitSettings.steps) return { reason: 'stepLimit' };
  }
}

/** The error as thrown, with the frame it was thrown in: a bug report in one paste. */
function describeFault(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const frame = error.stack?.split('\n').find((line) => line.trimStart().startsWith('at '));
  return frame ? `${String(error)}\n${frame}` : String(error);
}

async function runToEnd(request: AgentRunRequest, run: StartedRun): Promise<AgentRunEnd> {
  const { db } = request;
  const usage: RunUsage = { total: null };
  try {
    const stop = await loopSteps(request, run, usage);
    endRun(db, run, stop, usage.total);
    request.onEvent?.({ type: 'runEnded', stopReason: stop?.reason }, run);
    return { stopReason: stop?.reason, providerErrorReason: stop?.providerError?.reason };
  } catch (error) {
    failRun(db, run, describeFault(error), usage.total);
    throw error;
  }
}

/**
 * One ask, stored as started before this returns, then run to its end. Every way it ends
 * is stored before `ended` resolves; only a fault in Mosaic itself rejects, after storing
 * it as an `appFault` stop with its calls answered.
 */
export function startAgentRun(request: AgentRunRequest): StartedAgentRun {
  const run = beginRun(request);
  return { conversationId: run.conversationId, runId: run.runId, ended: runToEnd(request, run) };
}
