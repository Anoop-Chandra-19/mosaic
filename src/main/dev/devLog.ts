import {
  formatDevLogForReading,
  formatDevLogJson,
  type DevLogFields,
  type DevLogLevel,
} from './formatDevLog';

/*
 * The development log: what main is doing, in the terminal of `bun run dev`, as you would
 * watch a server's: lines to read in a terminal, or JSON when piped into something else
 * (`formatDevLog.ts`). `startDevLog.ts` turns it on and connects what can be watched from
 * outside; everywhere else only calls `devLog`, which does nothing until then, so an installed
 * Mosaic and the e2e tests pay one check. Facts only: names, times, sizes and statuses, never
 * an API key, a resume's text or what the model wrote. An error's own message is the
 * exception: it prints as written, and may quote what it failed on.
 */

export type { DevLogFields, DevLogLevel };

let isOn = false;

export const turnOnDevLog = (): void => {
  isOn = true;
};

/** For a caller with work to do before it can say anything. */
export const isDevLogOn = (): boolean => isOn;

export function devLog(
  context: string,
  message: string,
  fields: DevLogFields = {},
  level: DevLogLevel = 'info'
): void {
  if (!isOn) return;
  const entry = { at: new Date(), level, context, message, fields };
  console.log(process.stdout.isTTY ? formatDevLogForReading(entry) : formatDevLogJson(entry));
}

/** Whole milliseconds since `startedAt`, on the `performance.now()` clock. */
export const msSince = (startedAt: number): number => Math.round(performance.now() - startedAt);

/** Runs a step of starting up, and says how long it took. */
export function devLogStep<T>(context: string, step: string, run: () => T): T {
  const startedAt = performance.now();
  const result = run();
  devLog(context, step, { durationMs: msSince(startedAt) });
  return result;
}
