import { isRecord } from '@shared/resume/validateResume';
import type { MessageBody, RunStopReason, ToolTarget } from '@shared/types/agentConversation';
import type { ModelProviderError, ModelReplyPart } from '@shared/types/modelReply';

/*
 * Main checks every message body before it is written: the loop builds them, but a body
 * the next request can't be built from would break the conversation for good.
 */

type Check = (value: Record<string, unknown>) => boolean;

const isString = (value: unknown): value is string => typeof value === 'string';

const isOptional = (value: unknown, check: (value: unknown) => boolean) =>
  value === undefined || check(value);

const isListOf = (value: unknown, check: Check) =>
  Array.isArray(value) && value.every((item) => isRecord(item) && check(item));

const isResumeRef: Check = (ref) =>
  isString(ref.sectionId) &&
  isOptional(ref.entryId, isString) &&
  isOptional(ref.bulletId, isString) &&
  isString(ref.label);

const CHECK_BY_PART_TYPE: Record<ModelReplyPart['type'], Check> = {
  text: (part) => isString(part.text),
  reasoning: (part) =>
    isOptional(part.text, isString) &&
    Number.isFinite(part.durationMs) &&
    (part.durationMs as number) >= 0,
  // `args` is whatever the model wrote, malformed included: the repair round reads it.
  toolCall: (part) => isString(part.callId) && isString(part.name) && 'args' in part,
};

const isReplyPart: Check = (part) =>
  isString(part.type) &&
  Object.hasOwn(CHECK_BY_PART_TYPE, part.type) &&
  CHECK_BY_PART_TYPE[part.type as ModelReplyPart['type']](part);

const FINISH_REASONS: ReadonlySet<unknown> = new Set(['complete', 'outputLimit']);

const STOP_REASONS: ReadonlySet<unknown> = new Set<RunStopReason>([
  'repeatedCall',
  'refusalsInARow',
  'stepLimit',
  'connection',
  'providerError',
  'appFault',
  'cancelled',
]);

const isCount = (value: unknown) => Number.isInteger(value) && (value as number) >= 0;

const CHECK_BY_PROVIDER_ERROR: Record<ModelProviderError['reason'], Check> = {
  unreachable: () => true,
  rateLimited: (error) => isOptional(error.retryAfterMs, isCount),
  keyRefused: () => true,
  quotaExceeded: () => true,
  'model-not-found': () => true,
  toolsUnsupported: () => true,
  contentBlocked: () => true,
  'context-too-long': () => true,
  failed: (error) => isString(error.message),
};

const isProviderError = (error: unknown) =>
  isRecord(error) &&
  isString(error.reason) &&
  Object.hasOwn(CHECK_BY_PROVIDER_ERROR, error.reason) &&
  isOptional(error.message, isString) &&
  isOptional(error.httpStatus, isCount) &&
  CHECK_BY_PROVIDER_ERROR[error.reason as ModelProviderError['reason']](error);

const isStepRetry: Check = (retry) => isProviderError(retry.error) && isCount(retry.waitMs);

const hasRetriesIfAny = (body: Record<string, unknown>) =>
  isOptional(body.retries, (retries) => isListOf(retries, isStepRetry));

const isPositive = (value: unknown) => isCount(value) && (value as number) > 0;

const LIST_UNITS: ReadonlySet<unknown> = new Set(['section', 'entry', 'bullet', 'line']);

const CHECK_BY_TARGET_KIND: Record<ToolTarget['kind'], Check> = {
  resume: (target) => Array.isArray(target.sections) && target.sections.every(isString),
  version: (target) => isString(target.version),
  place: (target) =>
    isString(target.section) &&
    isOptional(target.entry, isString) &&
    isOptional(target.bullet, isPositive) &&
    isOptional(target.lastBullet, isPositive) &&
    isOptional(target.line, isPositive) &&
    isOptional(target.show, (show) => typeof show === 'boolean'),
  list: (target) =>
    LIST_UNITS.has(target.of) &&
    isOptional(target.section, isString) &&
    isOptional(target.entry, isString),
  term: (target) => isString(target.find) && isString(target.replace) && isCount(target.count),
};

export const isToolTarget = (target: unknown): target is ToolTarget =>
  isRecord(target) &&
  isString(target.kind) &&
  Object.hasOwn(CHECK_BY_TARGET_KIND, target.kind) &&
  CHECK_BY_TARGET_KIND[target.kind as ToolTarget['kind']](target);

const isToolResult: Check = (result) =>
  isString(result.callId) &&
  isString(result.content) &&
  isOptional(result.isError, (isError) => typeof isError === 'boolean') &&
  isOptional(result.target, isToolTarget) &&
  isOptional(result.notRun, (notRun) => typeof notRun === 'boolean') &&
  isOptional(result.checkName, isString) &&
  isOptional(result.durationMs, isCount) &&
  isOptional(result.startedAt, isCount);

const CHECK_BY_MESSAGE_TYPE: Record<MessageBody['type'], Check> = {
  user: (body) =>
    isString(body.text) && isListOf(body.resume, isResumeRef) && typeof body.isLimit === 'boolean',
  assistant: (body) =>
    isListOf(body.content, isReplyPart) &&
    isOptional(body.finish, (finish) => FINISH_REASONS.has(finish)) &&
    hasRetriesIfAny(body),
  toolResults: (body) => isListOf(body.results, isToolResult),
  templateSwitched: (body) =>
    isString(body.templateId) && isString(body.label) && isOptional(body.previousId, isString),
  runStopped: (body) =>
    STOP_REASONS.has(body.reason) &&
    isOptional(body.detail, isString) &&
    isOptional(body.providerError, isProviderError) &&
    isOptional(body.attempts, isCount) &&
    isOptional(body.waitedMs, isCount) &&
    hasRetriesIfAny(body),
};

/** Whether `value` is a message body this build can store and read back. */
export function isMessageBody(value: unknown): value is MessageBody {
  return (
    isRecord(value) &&
    isString(value.type) &&
    Object.hasOwn(CHECK_BY_MESSAGE_TYPE, value.type) &&
    CHECK_BY_MESSAGE_TYPE[value.type as MessageBody['type']](value)
  );
}
