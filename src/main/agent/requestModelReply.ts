import type { RunLimitSettings } from '@shared/agent/runLimitSettings';
import type { RunStopReason, StepRetry } from '@shared/types/agentConversation';
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
 * Collects one step's streamed model reply and forwards live events to the renderer.
 * Retries transient failures, enforces the inactivity deadline, and preserves partial
 * output on user cancellation.
 */

export type StepReply = { retries: StepRetry[] } & (
  | {
      ok: true;
      parts: ModelReplyPart[];
      finish: 'complete' | 'outputLimit';
      usage: ModelUsage | null;
      /**
       * Call start timestamps in epoch milliseconds. Without a `toolCallStart` event,
       * use the previous stream event's timestamp as an estimate of when generation began.
       */
      callStartedAt: ReadonlyMap<string, number>;
    }
  /** Partial output retained when the user cancels the request. */
  | { ok: false; reason: 'cancelled'; parts: ModelReplyPart[] }
  /** `connection` when retries are exhausted; `providerError` for non-retryable failures. */
  | {
      ok: false;
      reason: Extract<RunStopReason, 'connection' | 'providerError'>;
      error: ModelProviderError;
      attempts: number;
      waitedMs: number;
    }
);

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
 * Retry network failures, rate limits, and transient provider failures. Quota exhaustion,
 * missing models, and refusals need user action rather than another attempt.
 */
function isRetryable(error: ModelProviderError): boolean {
  if (error.reason === 'unreachable' || error.reason === 'rateLimited') return true;
  if (error.reason !== 'failed') return false;
  return error.httpStatus === undefined || error.httpStatus === 408 || error.httpStatus >= 500;
}

function addText(parts: ModelReplyPart[], text: string): void {
  const last = parts.at(-1);
  if (last?.type === 'text') last.text += text;
  else parts.push({ type: 'text', text });
}

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
      onEvent({ type: 'toolCall', callId: event.callId, name: event.name, args: event.args });
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
  // This is the reply's only timeout; adapters must not add their own. Reset it on
  // incoming activity, including chunks that produce no model event. A stall fails this
  // attempt and may be retried; user cancellation ends the run.
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
  const retries: StepRetry[] = [];
  let waitedMs = 0;
  for (;;) {
    const result = await streamOnce(options);
    if (result.ok) return { ...result, retries };
    if (result.cancelled) return { ok: false, reason: 'cancelled', parts: result.parts, retries };

    const { error } = result;
    const attempts = retries.length + 1;
    if (!isRetryable(error)) {
      return { ok: false, reason: 'providerError', error, attempts, waitedMs, retries };
    }
    if (retries.length >= limits.retryWaitsMs.length) {
      return { ok: false, reason: 'connection', error, attempts, waitedMs, retries };
    }
    const waitMs =
      (error.reason === 'rateLimited' ? error.retryAfterMs : undefined) ??
      limits.retryWaitsMs[retries.length];
    onEvent({ type: 'stepRetrying', attempt: attempts, waitMs, error });
    retries.push({ error, waitMs });
    await wait(waitMs, signal);
    waitedMs += waitMs;
    if (signal.aborted) return { ok: false, reason: 'cancelled', parts: [], retries };
  }
}
