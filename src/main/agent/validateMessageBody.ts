import { isRecord } from '@shared/resume/validateResume';
import type { MessageBody } from '@shared/types/agentConversation';
import type { ModelReplyPart } from '@shared/types/modelReply';

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

const isToolResult: Check = (result) =>
  isString(result.callId) &&
  isString(result.content) &&
  isOptional(result.isError, (isError) => typeof isError === 'boolean');

const CHECK_BY_MESSAGE_TYPE: Record<MessageBody['type'], Check> = {
  user: (body) =>
    isString(body.text) && isListOf(body.resume, isResumeRef) && typeof body.isLimit === 'boolean',
  assistant: (body) =>
    isListOf(body.content, isReplyPart) &&
    isOptional(body.finish, (finish) => FINISH_REASONS.has(finish)),
  toolResults: (body) => isListOf(body.results, isToolResult),
  templateSwitched: (body) =>
    isString(body.templateId) && isString(body.label) && isOptional(body.previousId, isString),
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
