import { RUN_LIMITS, type RunLimitSettings } from '@shared/agent/runLimitSettings';
import type { RunStopReason } from '@shared/types/agentConversation';

/* Tracks repeated tool errors and consecutive failed tool rounds to stop unproductive runs. */

export const REPEAT_WARNING =
  'You made this call before and it was refused for the same reason. Do something else, or finish.';

export interface ToolAnswerVerdict {
  /** Tool result content, including a repeated-call warning when applicable. */
  content: string;
  stop?: { reason: RunStopReason; detail: string };
}

interface ToolAnswerFacts {
  content: string;
  isError: boolean;
}

export interface RunLimits {
  /** Tracks repeated errors for the same call; returns warning text or a stop decision. */
  noteAnswer(name: string, args: unknown, answer: ToolAnswerFacts): ToolAnswerVerdict;
  /** Checks consecutive failed tool rounds after all non-cancelled calls have results. */
  noteStep(answers: ToolAnswerFacts[]): ToolAnswerVerdict['stop'];
}

/** Sort object keys recursively so argument key order does not change call identity. */
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
