import { describe, expect, it } from 'vitest';
import { ABORTED, untilAborted, waitUnlessAborted } from '../abortableWaits';

describe('abortable waits', () => {
  it('give the result, or ABORTED once the signal aborts, even when it already had', async () => {
    const stop = new AbortController();
    expect(await untilAborted(Promise.resolve('Done.'), stop.signal)).toBe('Done.');
    const waiting = untilAborted(new Promise(() => {}), stop.signal);
    stop.abort();
    expect(await waiting).toBe(ABORTED);
    expect(await untilAborted(Promise.resolve('Late.'), stop.signal)).toBe(ABORTED);
  });

  it('end a pause early on abort, without an error', async () => {
    const stop = new AbortController();
    const started = performance.now();
    const pause = waitUnlessAborted(60_000, stop.signal);
    stop.abort();
    await expect(pause).resolves.toBeUndefined();
    expect(performance.now() - started).toBeLessThan(1000);
  });
});
