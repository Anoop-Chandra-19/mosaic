import { describe, expect, it } from 'vitest';
import { readRateLimit } from '../readRateLimit';

const tooMany = (retryAfter?: string) =>
  new Response('', {
    status: 429,
    headers: retryAfter === undefined ? {} : { 'Retry-After': retryAfter },
  });

describe('readRateLimit', () => {
  it('reads a wait in seconds', () => {
    expect(readRateLimit(tooMany('7'))).toEqual({ reason: 'rateLimited', retryAfterMs: 7000 });
  });

  it('reads a wait until a date', () => {
    const now = Date.parse('2026-10-25T12:00:00Z');
    expect(readRateLimit(tooMany('Sun, 25 Oct 2026 12:00:30 GMT'), now)).toEqual({
      reason: 'rateLimited',
      retryAfterMs: 30_000,
    });
  });

  it.each([undefined, '', 'soon'])('leaves the wait out when it is %o', (retryAfter) => {
    expect(readRateLimit(tooMany(retryAfter))).toEqual({ reason: 'rateLimited' });
  });
});
