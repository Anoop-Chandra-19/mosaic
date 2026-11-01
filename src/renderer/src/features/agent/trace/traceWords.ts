import type { StepRetry } from '@shared/types/agentConversation';
import type { ModelUsage } from '@shared/types/modelReply';
import type { RowState } from '../run-line/runTimeline';

/*
 * How the Trace words the facts a run stored. The record is for someone reading closely, so
 * times keep their precision and counts are whole, and nothing is left out for being plain.
 */

const NUMBER = new Intl.NumberFormat('en-US');

/** "340 ms", "1.42 s". */
export const formatTraceTime = (ms: number): string =>
  ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2)} s`;

/** "1,204 in · 80 out", with what the provider's cache served when it said. */
export function formatTokens({ inputTokens, outputTokens, cachedInputTokens }: ModelUsage): string {
  const cached = cachedInputTokens ? ` (${NUMBER.format(cachedInputTokens)} cached)` : '';
  return `${NUMBER.format(inputTokens)} in${cached} · ${NUMBER.format(outputTokens)} out`;
}

/** Tokens belong to the request, and one request can make several calls. */
export const formatSharedTokens = (usage: ModelUsage, callCount: number): string =>
  callCount > 1 ? `${formatTokens(usage)}, shared by ${callCount} calls` : formatTokens(usage);

export const formatThinkingLength = (textLength: number): string =>
  `${NUMBER.format(textLength)} characters · stored, not shown`;

/** What a chip says beside a step that didn't simply finish; null when it did, or is going. */
export const STATE_CHIPS: Record<RowState, string | null> = {
  run: null,
  wait: 'waiting',
  done: null,
  fail: 'refused',
  cut: 'not run',
};

export const STATE_WORDS: Record<RowState, string> = {
  run: 'Running',
  wait: 'Waiting for the request to go again',
  done: 'Done',
  fail: 'Refused',
  cut: 'Not run',
};

const WHY_BY_CHECK: Record<string, string> = {
  timeout: 'The tool didn’t answer in time, so the run carried on without it.',
  cancelled: 'You stopped the run before this step was made. Nothing was staged from it.',
  stopped: 'The run stopped before this step was made. Nothing was staged from it.',
  interrupted: 'Mosaic closed before this step finished. Nothing was staged from it.',
};

export const describeCheck = (checkName: string | undefined): string | null =>
  checkName !== undefined && Object.hasOwn(WHY_BY_CHECK, checkName)
    ? WHY_BY_CHECK[checkName]
    : null;

/** One failed request: what happened, what the provider said, and how long it waited after. */
export function describeRetry({ error, waitMs }: StepRetry): string {
  const happened = error.reason === 'rateLimited' ? 'Asked to slow down' : 'Lost the connection';
  const status = error.httpStatus === undefined ? '' : ` · ${error.httpStatus}`;
  const said = error.message ? ` · ${error.message}` : '';
  return `${happened}${status}${said} · waited ${formatTraceTime(waitMs)}`;
}

/** As the model wrote them, set out to read; what isn't JSON stays as it came. */
export function formatToolArguments(args: unknown): string {
  return typeof args === 'string' ? args : (JSON.stringify(args, null, 2) ?? '');
}

/** A tool's answer is text for the model, which is often JSON worth setting out. */
export function formatToolAnswer(content: string): string {
  try {
    return JSON.stringify(JSON.parse(content), null, 2);
  } catch {
    return content;
  }
}
