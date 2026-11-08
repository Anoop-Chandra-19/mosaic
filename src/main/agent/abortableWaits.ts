import { setTimeout as sleep } from 'node:timers/promises';

/*
 * Cancellation-aware waits and restartable deadlines for model requests and tool rounds.
 * Use `AbortSignal.timeout` for fixed deadlines and `createRestartableDeadline` when
 * incoming activity should reset the deadline. Combine cancellation and deadline signals
 * with `AbortSignal.any`.
 */

export interface RestartableDeadline {
  /** Aborts after the configured milliseconds elapse without a restart. */
  signal: AbortSignal;
  restart(): void;
  /** Cancels the current timer without changing the signal's aborted state. */
  clear(): void;
}

export function createRestartableDeadline(ms: number): RestartableDeadline {
  const deadline = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const restart = () => {
    clearTimeout(timer);
    timer = setTimeout(() => deadline.abort(), ms);
  };
  restart();
  return { signal: deadline.signal, restart, clear: () => clearTimeout(timer) };
}

export const ABORTED = Symbol('aborted');

/** Stops waiting on abort and returns `ABORTED`; the underlying promise is not cancelled. */
export function untilAborted<T>(
  promise: Promise<T>,
  signal: AbortSignal
): Promise<T | typeof ABORTED> {
  if (signal.aborted) return Promise.resolve(ABORTED);
  return new Promise((resolve, reject) => {
    const abort = () => resolve(ABORTED);
    signal.addEventListener('abort', abort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', abort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', abort);
        reject(error);
      }
    );
  });
}

export type Wait = (ms: number, signal: AbortSignal) => Promise<void>;

/** Resolves early, without rejecting, when the signal aborts. */
export const waitUnlessAborted: Wait = (ms, signal) =>
  sleep(ms, undefined, { signal }).catch(() => {});
