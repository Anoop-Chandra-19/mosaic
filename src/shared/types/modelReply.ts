/** One piece of a model's reply, as stored and as sent back to the model on the next step. */
export type ModelReplyPart =
  | { type: 'text'; text: string }
  /** `providerState` goes back to the provider unchanged, for those that need it. */
  | { type: 'reasoning'; text?: string; durationMs: number; providerState?: unknown }
  /** Raw model arguments; malformed calls are handled by the repair round. */
  | { type: 'toolCall'; callId: string; name: string; args: unknown };

export interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
  /** The subset of `inputTokens` read from the provider's prompt cache, when reported. */
  cachedInputTokens?: number;
}

/**
 * The provider's verbatim error message and HTTP status, when available; for
 * `unreachable`, the network error message. Both are shown unchanged so users can
 * troubleshoot requests made with their own API key.
 */
interface ProviderWords {
  message?: string;
  httpStatus?: number;
}

/** Adapters classify provider errors; the pane never infers the reason from an HTTP status. */
export type ModelProviderError = ProviderWords &
  (
    | { reason: 'unreachable' }
    /** `retryAfterMs` is included when the provider specifies a wait time. */
    | { reason: 'rateLimited'; retryAfterMs?: number }
    /** The provider turned the API key down. */
    | { reason: 'keyRefused' }
    /** No credits or quota left: waiting won't help. */
    | { reason: 'quotaExceeded' }
    | { reason: 'model-not-found' }
    /** The model or its route does not support the tool calls the assistant requires. */
    | { reason: 'toolsUnsupported' }
    /** The provider's safety filter refused the request. */
    | { reason: 'contentBlocked' }
    | { reason: 'context-too-long' }
    /** An unclassified error; only its message is available to display. */
    | { reason: 'failed'; message: string }
  );

/**
 * A reply as it streams. It ends with one `finish` or `error`, or with nothing once the
 * request is cancelled.
 */
export type ModelStreamEvent =
  | { type: 'textDelta'; text: string }
  | { type: 'reasoningStart' }
  | { type: 'reasoningEnd'; text?: string; durationMs: number; providerState?: unknown }
  /** A tool call has started; the provider is still streaming its arguments. */
  | { type: 'toolCallStart'; callId: string; name: string }
  | { type: 'toolCall'; callId: string; name: string; args: unknown }
  | { type: 'finish'; reason: 'complete' | 'outputLimit'; usage: ModelUsage | null }
  | { type: 'error'; error: ModelProviderError };
