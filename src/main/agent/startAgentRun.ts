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
import { logRunStarted, logStepAsked, logStepFinished } from '../dev/logRunEvents';
import type { ModelProvider } from '../model-providers/modelProvider';
import { assembleModelContext, type DraftStamp } from './assembleModelContext';
import { buildSystemPrompt } from './buildSystemPrompt';
import { waitUnlessAborted, type Wait } from './abortableWaits';
import { requestModelReply } from './requestModelReply';
import { createRunLimits } from './runLimits';
import { runToolRound, type ToolBridge, type ToolCallPart } from './runToolRound';

/*
 * Executes one assistant run for a user message or a continuation. Each step builds
 * context from the conversation log (`assembleModelContext.ts`), requests and stores a
 * model reply (`requestModelReply.ts`), then executes its tools (`runToolRound.ts`).
 * A reply without tool calls completes the run. Limits (`runLimits.ts`), provider errors,
 * and cancellation stop it; the stop is stored without discarding staged changes.
 * Called by `agentRuns.ts` and run tests.
 */

/**
 * A user message or a continuation without a new message. A null `conversationId`
 * creates a conversation; otherwise the run appends to the existing conversation.
 */
export type AgentAsk =
  | { type: 'user'; conversationId: number | null; text: string }
  | { type: 'carryOn'; conversationId: number };

export interface AgentRunRequest {
  db: Database;
  ask: AgentAsk;
  /** The template open when the run was requested, or null if none was open. */
  templateId: string | null;
  model: { provider: string; name: string };
  modelProvider: ModelProvider;
  bridge: ToolBridge;
  signal: AbortSignal;
  /** Includes run IDs because events can arrive before `startAgentRun` returns them. */
  onEvent?: (event: AgentRunEvent, run: ConversationRun) => void;
  limits?: RunLimitSettings;
  wait?: Wait;
}

export interface AgentRunEnd {
  /** Undefined when the model completes the run without a stop. */
  stopReason?: RunStopReason;
  /** Provider error classification, if a provider failure stopped the run. */
  providerErrorReason?: ModelProviderError['reason'];
}

/** The run's start is already stored; `ended` settles after its end is stored. */
export interface StartedAgentRun extends ConversationRun {
  ended: Promise<AgentRunEnd>;
}

interface StartedRun extends ConversationRun {
  draft: DraftStamp | null;
  resumeName: string | null;
}

function beginRun({ db, ask, templateId, model }: AgentRunRequest): StartedRun {
  const choice = { templateId, provider: model.provider, model: model.name };
  const { conversationId, runId, runNumber, template } =
    ask.type === 'user'
      ? startUserRun(db, { ...choice, conversationId: ask.conversationId, text: ask.text })
      : startCarryOnRun(db, { ...choice, conversationId: ask.conversationId });
  logRunStarted({ runId, conversationId, runNumber, provider: model.provider, model: model.name });
  return {
    conversationId,
    runId,
    draft: template && { templateId: template.id, rev: template.rev },
    resumeName: template?.name ?? null,
  };
}

/** Accumulated token usage; null until the provider reports usage for a step. */
type RunUsage = { total: ModelUsage | null };

/** Leave the count undefined until a step reports it; missing usage is not zero. */
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
    logStepAsked(run.runId, step, messages.length);
    const reply = await requestModelReply({
      provider: modelProvider,
      request: { model: modelName, system, messages, tools, cacheKey },
      signal,
      onEvent,
      limits: limitSettings,
      wait: request.wait ?? waitUnlessAborted,
    });
    const { retries } = reply;
    // Store retry records with the model reply, or with the stop if no reply is stored.
    const stopRetries = retries.length > 0 ? { retries } : {};
    if (!reply.ok && reply.reason === 'cancelled') {
      // Preserve partial output, but omit tool calls that will never receive results.
      const kept = reply.parts.filter((part) => part.type !== 'toolCall');
      if (kept.length === 0) return { reason: 'cancelled', ...stopRetries };
      storeModelReply(db, run, { parts: kept, retries, model: modelName, rev: null });
      return { reason: 'cancelled' };
    }
    if (!reply.ok) {
      const { reason, error, attempts, waitedMs } = reply;
      return { reason, providerError: error, attempts, waitedMs, ...stopRetries };
    }

    addUsage(usage, reply.usage);
    const { parts, finish } = reply;
    logStepFinished(run.runId, reply.usage, finish);
    storeModelReply(db, run, {
      parts,
      finish,
      usage: reply.usage,
      retries,
      model: modelName,
      rev: draft?.rev ?? null,
    });
    const calls = reply.parts.filter((part): part is ToolCallPart => part.type === 'toolCall');
    if (calls.length === 0) return undefined;

    const round = await runToolRound({
      db,
      run,
      calls,
      callStartedAt: reply.callStartedAt,
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

/** Include the first stack frame so the stored fault identifies its source location. */
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
 * Stores the run's start synchronously, then executes it asynchronously. Normal completion,
 * cancellation, and provider failures resolve `ended` after storing the outcome. App faults
 * reject it after attempting to store an `appFault` stop and results for pending tool calls.
 */
export function startAgentRun(request: AgentRunRequest): StartedAgentRun {
  const run = beginRun(request);
  return { conversationId: run.conversationId, runId: run.runId, ended: runToEnd(request, run) };
}
