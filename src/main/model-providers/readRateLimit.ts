import type { ModelProviderError } from '@shared/types/modelReply';

/**
 * A 429, with how long the provider asked us to wait when it said: `Retry-After` is
 * either seconds or an HTTP date.
 */
export function readRateLimit(headers: Headers, now = Date.now()): ModelProviderError {
  const retryAfter = headers.get('retry-after')?.trim();
  if (!retryAfter) return { reason: 'rateLimited' };
  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return { reason: 'rateLimited', retryAfterMs: seconds * 1000 };
  }
  const at = Date.parse(retryAfter);
  return Number.isNaN(at)
    ? { reason: 'rateLimited' }
    : { reason: 'rateLimited', retryAfterMs: Math.max(0, at - now) };
}
