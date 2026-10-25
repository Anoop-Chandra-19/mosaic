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

/**
 * What the provider said, word for word, and its HTTP status, whenever it gave them; for
 * `unreachable`, what the network said. The user is shown both as they came: with their
 * own key, they are the one who fixes it.
 */
interface ProviderWords {
  message?: string;
  httpStatus?: number;
}

/** Each adapter sorts its provider's errors into these; the pane never guesses from a status. */
export type ModelProviderError = ProviderWords &
  (
    | { reason: 'unreachable' }
    /** `retryAfterMs` when the provider said how long to wait. */
    | { reason: 'rateLimited'; retryAfterMs?: number }
    /** The provider turned the API key down. */
    | { reason: 'keyRefused' }
    /** No credits or quota left: waiting won't help. */
    | { reason: 'quotaExceeded' }
    | { reason: 'model-not-found' }
    /** The model, or its route, can't take tools, which the assistant needs. */
    | { reason: 'toolsUnsupported' }
    /** The provider's safety filter refused the request. */
    | { reason: 'contentBlocked' }
    | { reason: 'context-too-long' }
    /** Anything else; the message is all there is to show. */
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
  | { type: 'toolCall'; callId: string; name: string; args: unknown }
  | { type: 'finish'; reason: 'complete' | 'outputLimit'; usage: ModelUsage | null }
  | { type: 'error'; error: ModelProviderError };
