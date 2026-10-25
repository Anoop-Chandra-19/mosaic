import type { RunStopReason } from '@shared/types/agentConversation';

/*
 * When a run stops on its own. A refused call the model then fixes is the loop working, so
 * errors as such never stop a run; a loop that isn't getting anywhere does, and so does a
 * connection that isn't there. Defaults, not settings, until the evals show a need.
 */
export const RUN_LIMITS = {
  /** The same call refused with the same answer: the 2nd time is warned, this one stops. */
  sameRefusalsBeforeStop: 3,
  /** Refused calls with nothing done between them. */
  refusalsInARow: 5,
  /** Tool rounds in one run. */
  steps: 40,
  /** A request that failed in a way worth trying again waits this long before each retry. */
  retryWaitsMs: [1000, 4000, 16_000],
  /** No stream data for this long counts as a failed request. */
  stallMs: 60_000,
  /** A tool the page doesn't answer in this long fails, and the run carries on. */
  toolAnswerMs: 10_000,
};

export type RunLimitSettings = typeof RUN_LIMITS;

export const REPEAT_WARNING =
  'You made this call before and it was refused for the same reason. Do something else, or finish.';

export interface ToolAnswerVerdict {
  /** The answer as the model reads it. */
  content: string;
  stop?: { reason: RunStopReason; detail: string };
}

export interface RunLimits {
  /** Counts one answered call; the warning goes on the answer, a stop ends the run. */
  noteAnswer(
    name: string,
    args: unknown,
    answer: { content: string; isError: boolean }
  ): ToolAnswerVerdict;
}

/** Object keys sorted, so the same arguments in another order count as the same call. */
function writeStableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(writeStableJson).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${writeStableJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'undefined';
}

export function createRunLimits(limits: RunLimitSettings = RUN_LIMITS): RunLimits {
  const refusalsByCall = new Map<string, { content: string; count: number }>();
  let refusalsInARow = 0;

  return {
    noteAnswer(name, args, { content, isError }) {
      if (!isError) {
        refusalsInARow = 0;
        return { content };
      }
      refusalsInARow += 1;
      const callKey = `${name} ${writeStableJson(args)}`;
      const earlier = refusalsByCall.get(callKey);
      const count = earlier?.content === content ? earlier.count + 1 : 1;
      refusalsByCall.set(callKey, { content, count });

      if (count >= limits.sameRefusalsBeforeStop) {
        return { content, stop: { reason: 'repeatedCall', detail: content } };
      }
      if (refusalsInARow >= limits.refusalsInARow) {
        return { content, stop: { reason: 'refusalsInARow', detail: content } };
      }
      return count > 1 ? { content: `${content}\n${REPEAT_WARNING}` } : { content };
    },
  };
}
