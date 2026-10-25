/** One piece of a model's reply, as stored and as sent back to the model on the next step. */
export type ModelReplyPart =
  | { type: 'text'; text: string }
  /** `providerState` goes back to the provider unchanged, for those that need it. */
  | { type: 'reasoning'; text?: string; durationMs: number; providerState?: unknown }
  /** `args` as the model wrote them; a malformed call goes to the repair round. */
  | { type: 'toolCall'; callId: string; name: string; args: unknown };

export interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
}

export type ModelProviderError =
  | { reason: 'unreachable' }
  /** `retryAfterMs` when the provider said how long to wait. */
  | { reason: 'rateLimited'; retryAfterMs?: number }
  /** No credits or quota left: waiting won't help. */
  | { reason: 'quotaExceeded'; message: string; httpStatus?: number }
  | { reason: 'model-not-found' }
  /** The model, or its route, can't take tools, which the assistant needs. */
  | { reason: 'toolsUnsupported'; message: string }
  /** The provider's safety filter refused the request. */
  | { reason: 'contentBlocked'; message: string }
  | { reason: 'context-too-long' }
  | { reason: 'failed'; message: string; httpStatus?: number };

/**
 * A reply as it streams. It ends with one `finish` or `error`, or with nothing once the
 * request is cancelled.
 */
export type ModelStreamEvent =
  | { type: 'textDelta'; text: string }
  | { type: 'reasoningStart' }
  | { type: 'reasoningEnd'; text?: string; durationMs: number; providerState?: unknown }
  | { type: 'toolCall'; callId: string; name: string; args: unknown }
  | { type: 'finish'; reason: 'complete' | 'outputLimit'; usage: ModelUsage | null }
  | { type: 'error'; error: ModelProviderError };
