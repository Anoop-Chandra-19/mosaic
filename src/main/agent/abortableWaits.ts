import { setTimeout as sleep } from 'node:timers/promises';

/*
 * The run's waits, each cut short when its signal aborts: the user's Stop, or a deadline
 * combined with it (`AbortSignal.any`). Nothing else in the loop handles listeners or
 * timers. A one-off wait uses `AbortSignal.timeout`; one that news can push back, this file.
 */

export interface RestartableDeadline {
  /** Aborts once the time passes with no restart. */
  signal: AbortSignal;
  restart(): void;
  /** Done waiting: the timer goes, and the signal never aborts. */
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

/** The promise's result, or `ABORTED` as soon as the signal aborts. */
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

/** A pause that ends early, without an error, when the signal aborts. */
export const waitUnlessAborted: Wait = (ms, signal) =>
  sleep(ms, undefined, { signal }).catch(() => {});
