import type { RunLimitSettings } from '@shared/agent/runLimitSettings';
import type { RunStopReason } from '@shared/types/agentConversation';
import type { AgentRunEvent } from '@shared/types/agentRunEvents';
import type {
  ModelProviderError,
  ModelReplyPart,
  ModelStreamEvent,
  ModelUsage,
} from '@shared/types/modelReply';
import type { ModelProvider, ModelRequest } from '../model-providers/modelProvider';
import { createRestartableDeadline, type Wait } from './abortableWaits';

/*
 * One step's request: streamed into the reply's parts, sent again when it failed in a
 * way worth retrying (the connection layer), and cut off by the user's Stop.
 */

export type StepReply =
  | {
      ok: true;
      parts: ModelReplyPart[];
      finish: 'complete' | 'outputLimit';
      usage: ModelUsage | null;
      /**
       * When each call began. A provider that sends calls whole can't say, so theirs count from
       * the last thing the model did before it: the time it spent writing the call.
       */
      callStartedAt: ReadonlyMap<string, number>;
    }
  /** Stopped by the user; `parts` is what had arrived, to keep. */
  | { ok: false; reason: 'cancelled'; parts: ModelReplyPart[] }
  /** `connection` once retries ran out; `providerError` when retrying couldn't help. */
  | {
      ok: false;
      reason: Extract<RunStopReason, 'connection' | 'providerError'>;
      error: ModelProviderError;
      attempts: number;
      waitedMs: number;
    };

export interface ReplyRequest {
  provider: ModelProvider;
  request: Omit<ModelRequest, 'signal'>;
  signal: AbortSignal;
  onEvent: (event: AgentRunEvent) => void;
  limits: RunLimitSettings;
  wait: Wait;
}

type Attempt =
  | {
      ok: true;
      parts: ModelReplyPart[];
      finish: 'complete' | 'outputLimit';
      usage: ModelUsage | null;
      callStartedAt: ReadonlyMap<string, number>;
    }
  | { ok: false; cancelled: true; parts: ModelReplyPart[] }
  | { ok: false; cancelled: false; error: ModelProviderError };

const STALLED: ModelProviderError = { reason: 'failed', message: 'The reply stopped arriving' };
const ENDED_EARLY: ModelProviderError = { reason: 'failed', message: 'The reply ended early' };

/**
 * Worth sending again: the network, a rate limit, the provider's own trouble. Never an
 * empty quota, a missing model or a refusal, which waiting doesn't change.
 */
function isRetryable(error: ModelProviderError): boolean {
  if (error.reason === 'unreachable' || error.reason === 'rateLimited') return true;
  if (error.reason !== 'failed') return false;
  return error.httpStatus === undefined || error.httpStatus === 408 || error.httpStatus >= 500;
}

/** Text arrives in pieces; consecutive pieces are one part. */
function addText(parts: ModelReplyPart[], text: string): void {
  const last = parts.at(-1);
  if (last?.type === 'text') last.text += text;
  else parts.push({ type: 'text', text });
}

/** Collects one event into the parts, and passes on what a live view shows. */
function takeEvent(
  parts: ModelReplyPart[],
  callStartedAt: Map<string, number>,
  event: ModelStreamEvent,
  lastEventAt: number,
  onEvent: (event: AgentRunEvent) => void
): void {
  switch (event.type) {
    case 'textDelta':
      addText(parts, event.text);
      onEvent(event);
      return;
    case 'reasoningStart':
      onEvent(event);
      return;
    case 'reasoningEnd':
      parts.push({
        type: 'reasoning',
        text: event.text,
        durationMs: event.durationMs,
        providerState: event.providerState,
      });
      onEvent({ type: 'reasoningEnd', durationMs: event.durationMs });
      return;
    case 'toolCallStart':
      callStartedAt.set(event.callId, Date.now());
      onEvent({ type: 'toolCall', callId: event.callId, name: event.name });
      return;
    case 'toolCall':
      if (!callStartedAt.has(event.callId)) callStartedAt.set(event.callId, lastEventAt);
      parts.push({ type: 'toolCall', callId: event.callId, name: event.name, args: event.args });
      onEvent({ type: 'toolCall', callId: event.callId, name: event.name });
      return;
  }
}

async function streamOnce({
  provider,
  request,
  signal,
  onEvent,
  limits,
}: ReplyRequest): Promise<Attempt> {
  // The one timeout on a reply, from before the request goes until its last event, restarted
  // by anything that arrives, so no provider needs its own. A stall ends this attempt only;
  // the user's Stop ends the run.
  const stall = createRestartableDeadline(limits.stallMs);
  const parts: ModelReplyPart[] = [];
  const callStartedAt = new Map<string, number>();
  let lastEventAt = Date.now();
  try {
    const attemptSignal = AbortSignal.any([signal, stall.signal]);
    const attempt = { ...request, signal: attemptSignal, onArrival: stall.restart };
    for await (const event of provider.streamReply(attempt)) {
      stall.restart();
      if (event.type === 'finish')
        return { ok: true, parts, finish: event.reason, usage: event.usage, callStartedAt };
      if (event.type === 'error') return { ok: false, cancelled: false, error: event.error };
      takeEvent(parts, callStartedAt, event, lastEventAt, onEvent);
      lastEventAt = Date.now();
    }
    if (signal.aborted) return { ok: false, cancelled: true, parts };
    return { ok: false, cancelled: false, error: stall.signal.aborted ? STALLED : ENDED_EARLY };
  } finally {
    stall.clear();
  }
}

export async function requestModelReply(options: ReplyRequest): Promise<StepReply> {
  const { signal, onEvent, limits, wait } = options;
  let waitedMs = 0;
  for (let retries = 0; ; retries++) {
    const result = await streamOnce(options);
    if (result.ok) return result;
    if (result.cancelled) return { ok: false, reason: 'cancelled', parts: result.parts };

    const { error } = result;
    const attempts = retries + 1;
    if (!isRetryable(error)) {
      return { ok: false, reason: 'providerError', error, attempts, waitedMs };
    }
    if (retries >= limits.retryWaitsMs.length) {
      return { ok: false, reason: 'connection', error, attempts, waitedMs };
    }
    const waitMs =
      (error.reason === 'rateLimited' ? error.retryAfterMs : undefined) ??
      limits.retryWaitsMs[retries];
    onEvent({ type: 'stepRetrying', attempt: attempts, waitMs, error });
    await wait(waitMs, signal);
    waitedMs += waitMs;
    if (signal.aborted) return { ok: false, reason: 'cancelled', parts: [] };
  }
}
