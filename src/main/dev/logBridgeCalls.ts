import { isRecord } from '@shared/resume/validateResume';
import { devLog, msSince } from './devLog';

/*
 * Each call from the page through the bridge: its channel, how long main took, and how it
 * came out. Its arguments and its answer are never looked at beyond an expected refusal's
 * code, since they hold resumes and API keys.
 */

const MAX_ERROR_LENGTH = 300;

/** A refusal answered rather than thrown: `{ ok: false, code }` or `{ ok: false, reason }`. */
export function readRefusal(answer: unknown): string | null {
  if (!isRecord(answer) || answer.ok !== false) return null;
  const why = answer.code ?? answer.reason;
  return typeof why === 'string' ? why : 'no reason given';
}

const describeError = (error: unknown) =>
  (error instanceof Error ? error.message : String(error)).slice(0, MAX_ERROR_LENGTH);

/** The handler, doing just what it did, with a line in the log once it has answered. */
export function withBridgeLog<Args extends unknown[], Answer>(
  channel: string,
  answer: (...args: Args) => Answer | Promise<Answer>
): (...args: Args) => Promise<Answer> {
  return async (...args) => {
    const startedAt = performance.now();
    try {
      const answered = await answer(...args);
      const reason = readRefusal(answered);
      const durationMs = msSince(startedAt);
      if (reason === null) {
        devLog('bridge', 'call answered', { channel, durationMs, outcome: 'ok' });
      } else {
        devLog(
          'bridge',
          'call refused',
          { channel, durationMs, outcome: 'refused', reason },
          'warn'
        );
      }
      return answered;
    } catch (error) {
      devLog(
        'bridge',
        'call failed',
        { channel, durationMs: msSince(startedAt), outcome: 'failed', error: describeError(error) },
        'error'
      );
      throw error;
    }
  };
}
