import type { AgentRunEnvelope } from '@shared/types/agentBridge';
import type { AgentRunEvent } from '@shared/types/agentRunEvents';
import type { ModelUsage } from '@shared/types/modelReply';
import { devLog, isDevLogOn, msSince, type DevLogFields, type DevLogLevel } from './devLog';

/*
 * An assistant run in the log: which conversation and model, how long the model took to
 * answer, what each step cost, each tool, and how it ended. Every line carries the same
 * fields, so one conversation or run can be picked out. Most of it comes from the events the
 * pane follows; `startAgentRun.ts` adds what only it knows. Text arrives in many small
 * pieces, so it is said once it is over, as how much; what it says, and the arguments and
 * answers of tool calls, stay out.
 */

interface RunFacts {
  runId: number;
  conversationId: number;
  /** Its number in its conversation, from 1. */
  runNumber: number;
  provider: string;
  model: string;
}

interface RunSoFar {
  /** On every line of the run. */
  fields: DevLogFields;
  startedAt: number;
  stepStartedAt: number;
  step: number;
  hasFirstReply: boolean;
  /** Text under way: how much so far, and since when. */
  writing: { chars: number; since: number } | null;
  toolNameById: Map<string, string>;
  refusals: number;
  tokensIn: number;
  tokensOut: number;
}

const runs = new Map<number, RunSoFar>();

function say(run: RunSoFar, message: string, fields: DevLogFields = {}, level?: DevLogLevel) {
  devLog('run', message, { ...run.fields, step: run.step || undefined, ...fields }, level);
}

/** Said once its number and model are known, before its first event. */
export function logRunStarted({ runId, conversationId, runNumber, provider, model }: RunFacts) {
  if (!isDevLogOn()) return;
  const now = performance.now();
  const run: RunSoFar = {
    fields: { conversation: conversationId, run: runNumber, runId, provider, model },
    startedAt: now,
    stepStartedAt: now,
    step: 0,
    hasFirstReply: false,
    writing: null,
    toolNameById: new Map(),
    refusals: 0,
    tokensIn: 0,
    tokensOut: 0,
  };
  runs.set(runId, run);
  say(run, 'run started');
}

export function logStepAsked(runId: number, step: number, messageCount: number): void {
  const run = runs.get(runId);
  if (!run) return;
  run.stepStartedAt = performance.now();
  run.hasFirstReply = false;
  run.step = step;
  say(run, 'asking the model', { messages: messageCount });
}

function sayFirstReply(run: RunSoFar): void {
  if (run.hasFirstReply) return;
  run.hasFirstReply = true;
  say(run, 'first reply', { durationMs: msSince(run.stepStartedAt) });
}

function sayWritingOver(run: RunSoFar): void {
  if (!run.writing) return;
  say(run, 'text written', { chars: run.writing.chars, durationMs: msSince(run.writing.since) });
  run.writing = null;
}

/** The reply is whole: what the step took and cost, which only the provider's last word says. */
export function logStepFinished(
  runId: number,
  usage: ModelUsage | null,
  finish: 'complete' | 'outputLimit'
): void {
  const run = runs.get(runId);
  if (!run) return;
  sayWritingOver(run);
  run.tokensIn += usage?.inputTokens ?? 0;
  run.tokensOut += usage?.outputTokens ?? 0;
  say(
    run,
    'model answered',
    {
      durationMs: msSince(run.stepStartedAt),
      tokensIn: usage?.inputTokens,
      tokensOut: usage?.outputTokens,
      tokensCached: usage?.cachedInputTokens,
      finish,
    },
    finish === 'outputLimit' ? 'warn' : 'info'
  );
}

function logRunEvent(runId: number, run: RunSoFar, event: AgentRunEvent): void {
  switch (event.type) {
    case 'stepRetrying':
      say(
        run,
        'retrying',
        {
          attempt: event.attempt,
          waitMs: event.waitMs,
          reason: event.error.reason,
          httpStatus: event.error.httpStatus,
        },
        'warn'
      );
      run.hasFirstReply = false;
      run.stepStartedAt = performance.now() + event.waitMs;
      return;
    case 'reasoningEnd':
      say(run, 'thought', { durationMs: event.durationMs });
      return;
    case 'toolCall':
      // Told once when it begins, where its provider can say, and again when it is whole.
      if (run.toolNameById.has(event.callId)) return;
      run.toolNameById.set(event.callId, event.name);
      say(run, 'tool started', { tool: event.name, callId: event.callId });
      return;
    case 'toolResult': {
      if (event.isError) run.refusals += 1;
      say(
        run,
        'tool finished',
        {
          tool: run.toolNameById.get(event.callId),
          callId: event.callId,
          durationMs: event.durationMs,
          outcome: event.isError ? 'refused' : 'ok',
        },
        event.isError ? 'warn' : 'info'
      );
      return;
    }
    case 'runEnded': {
      const isProblem = event.stopReason !== undefined && event.stopReason !== 'cancelled';
      say(
        run,
        'run ended',
        {
          outcome: event.stopReason ?? 'finished',
          durationMs: msSince(run.startedAt),
          steps: run.step,
          tools: run.toolNameById.size,
          refusals: run.refusals,
          tokensIn: run.tokensIn,
          tokensOut: run.tokensOut,
        },
        isProblem ? 'error' : 'info'
      );
      runs.delete(runId);
    }
  }
}

/** Follows one event of a run the log was told of. */
export function logRunEnvelope({ runId, event }: AgentRunEnvelope): void {
  const run = runs.get(runId);
  if (!run) return;
  if (event.type !== 'stepStarted' && event.type !== 'stepRetrying' && event.type !== 'runEnded') {
    sayFirstReply(run);
  }
  if (event.type === 'textDelta') {
    run.writing ??= { chars: 0, since: performance.now() };
    run.writing.chars += event.text.length;
    return;
  }
  sayWritingOver(run);
  logRunEvent(runId, run, event);
}
