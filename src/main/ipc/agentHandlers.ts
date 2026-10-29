import type { Database } from 'better-sqlite3';
import { isRecord } from '@shared/resume/validateResume';
import type { AgentToolResult } from '@shared/agent-tools/agentTools';
import {
  MAX_AGENT_MESSAGE_LENGTH,
  type AgentStart,
  type AgentToolAnswer,
  type MessagePage,
} from '@shared/types/agentBridge';
import type { TranscriptMessage } from '@shared/types/agentConversation';
import type { AgentRuns, RunPage } from '../agent/agentRuns';
import { readLastConversationId } from '../db/conversations/conversations';
import { readMessagePage } from '../db/conversations/messages';

/*
 * Main's side of `MosaicAgent`, kept free of Electron so tests can drive it directly;
 * `registerAgentHandlers.ts` wires it to IPC, with the page each call came from.
 */

const MAX_ID_LENGTH = 200;
const MAX_PAGE_LIMIT = 200;
/** A tool's answer is what the model reads: a whole resume at most. */
const MAX_TOOL_ANSWER_LENGTH = 1_000_000;

/** Every argument arrives unchecked. */
export interface AgentHandlers {
  start(page: RunPage, request: unknown): Promise<AgentStart>;
  carryOn(page: RunPage, request: unknown): Promise<AgentStart>;
  stop(runId: unknown): void;
  readMessages(conversationId: unknown, page: unknown): TranscriptMessage[];
  readLastConversationId(): number | null;
  answerTool(runId: unknown, callId: unknown, answer: unknown): void;
}

const isText = (value: unknown, maxLength: number): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= maxLength;

const isCount = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;

function rowId(value: unknown, what: string): number {
  if (!isCount(value) || value === 0) throw new Error(`${what} must be a whole number above 0`);
  return value;
}

function id(value: unknown, what: string): string {
  if (!isText(value, MAX_ID_LENGTH)) {
    throw new Error(`${what} must be text of 1–${MAX_ID_LENGTH} characters`);
  }
  return value;
}

function nullable<T>(value: unknown, check: (value: unknown) => T): T | null {
  return value === null ? null : check(value);
}

function request(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new Error('the request must be an object');
  return value;
}

function messageText(value: unknown): string {
  if (!isText(value, MAX_AGENT_MESSAGE_LENGTH) || value.trim() === '') {
    throw new Error(`text must be 1–${MAX_AGENT_MESSAGE_LENGTH} characters, not only spaces`);
  }
  return value;
}

function messagePage(value: unknown): MessagePage {
  const { beforeSeq, limit } = request(value);
  if (!isCount(limit) || limit === 0 || limit > MAX_PAGE_LIMIT) {
    throw new Error(`limit must be 1–${MAX_PAGE_LIMIT}`);
  }
  if (beforeSeq === undefined) return { limit };
  if (!isCount(beforeSeq)) throw new Error('beforeSeq must be a whole number of 0 or more');
  return { beforeSeq, limit };
}

function draftStamp(value: unknown): AgentToolResult['draft'] {
  if (value === null) return null;
  const { templateId, rev } = request(value);
  if (!isCount(rev)) throw new Error('the draft’s rev must be a whole number of 0 or more');
  return { templateId: id(templateId, 'the draft’s templateId'), rev };
}

function toolAnswer(value: unknown): AgentToolAnswer {
  const answer = request(value);
  if (answer.ok === false) {
    if (typeof answer.message !== 'string') throw new Error('a failed answer needs its message');
    return { ok: false, message: answer.message.slice(0, MAX_TOOL_ANSWER_LENGTH) };
  }
  if (answer.ok !== true) throw new Error('an answer must say whether the tool ran');
  const { content, isError, draft } = request(answer.result);
  if (typeof content !== 'string' || content.length > MAX_TOOL_ANSWER_LENGTH) {
    throw new Error(`content must be text of at most ${MAX_TOOL_ANSWER_LENGTH} characters`);
  }
  if (typeof isError !== 'boolean') throw new Error('isError must be true or false');
  return { ok: true, result: { content, isError, draft: draftStamp(draft) } };
}

export function createAgentHandlers(runs: AgentRuns, currentDb: () => Database): AgentHandlers {
  return {
    start: (page, value) => {
      const { conversationId, text, templateId } = request(value);
      return runs.start(page, {
        conversationId: nullable(conversationId, (given) => rowId(given, 'conversationId')),
        text: messageText(text),
        templateId: nullable(templateId, (given) => id(given, 'templateId')),
      });
    },
    carryOn: (page, value) => {
      const { conversationId, templateId } = request(value);
      return runs.carryOn(page, {
        conversationId: rowId(conversationId, 'conversationId'),
        templateId: nullable(templateId, (given) => id(given, 'templateId')),
      });
    },
    stop: (runId) => runs.stop(rowId(runId, 'runId')),
    readMessages: (conversationId, page) =>
      readMessagePage(currentDb(), rowId(conversationId, 'conversationId'), messagePage(page)),
    readLastConversationId: () => readLastConversationId(currentDb()),
    answerTool: (runId, callId, answer) =>
      runs.answerTool(rowId(runId, 'runId'), id(callId, 'callId'), toolAnswer(answer)),
  };
}
