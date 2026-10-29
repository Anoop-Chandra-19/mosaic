import { RUN_LIMITS, type RunLimitSettings } from '@shared/agent/runLimitSettings';
import type { RunStopReason } from '@shared/types/agentConversation';

/* The stop layers: counts a run's answers against `RUN_LIMITS`. */

export const REPEAT_WARNING =
  'You made this call before and it was refused for the same reason. Do something else, or finish.';

export interface ToolAnswerVerdict {
  /** The answer as the model reads it. */
  content: string;
  stop?: { reason: RunStopReason; detail: string };
}

interface ToolAnswerFacts {
  content: string;
  isError: boolean;
}

export interface RunLimits {
  /** Counts one answered call; the warning goes on the answer, a stop ends the run. */
  noteAnswer(name: string, args: unknown, answer: ToolAnswerFacts): ToolAnswerVerdict;
  /** Counts a step by its answered calls, once they are all in. */
  noteStep(answers: ToolAnswerFacts[]): ToolAnswerVerdict['stop'];
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
  let refusedStepsInARow = 0;

  return {
    noteAnswer(name, args, { content, isError }) {
      if (!isError) return { content };
      const callKey = `${name} ${writeStableJson(args)}`;
      const earlier = refusalsByCall.get(callKey);
      const count = earlier?.content === content ? earlier.count + 1 : 1;
      refusalsByCall.set(callKey, { content, count });

      if (count >= limits.sameRefusalsBeforeStop) {
        return { content, stop: { reason: 'repeatedCall', detail: content } };
      }
      return count > 1 ? { content: `${content}\n${REPEAT_WARNING}` } : { content };
    },

    noteStep(answers) {
      const lastAnswer = answers.at(-1);
      if (!lastAnswer) return undefined;
      if (answers.some((answer) => !answer.isError)) {
        refusedStepsInARow = 0;
        return undefined;
      }
      refusedStepsInARow += 1;
      return refusedStepsInARow >= limits.refusedStepsInARow
        ? { reason: 'refusalsInARow', detail: lastAnswer.content }
        : undefined;
    },
  };
}
