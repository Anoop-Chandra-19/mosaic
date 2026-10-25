import type { Database } from 'better-sqlite3';
import type { ToolResultsMessageBody } from '@shared/types/agentConversation';
import { appendMessage } from './messages';
import type { ConversationRun } from './runs';

export interface NewToolCall {
  runId: number;
  /** The assistant message whose `toolCall` part asked for it. */
  requestMessageId: number;
  callId: string;
  name: string;
  /** The rev it reads or writes against; null with no template open. */
  rev: number | null;
}

/** Recorded as pending, in the same transaction as the message that asked for it. */
export function recordToolCall(db: Database, call: NewToolCall): void {
  db.prepare(
    `insert into tool_calls (run_id, request_message_id, call_id, name, status, rev, started_at)
     values (?, ?, ?, ?, 'pending', ?, ?)`
  ).run(call.runId, call.requestMessageId, call.callId, call.name, call.rev, Date.now());
}

export interface ToolCallEnd {
  runId: number;
  callId: string;
  status: 'ok' | 'error' | 'cancelled';
  /** Why it failed when the tool didn't answer: `timeout`, `cancelled`. */
  checkName?: string;
  resultMessageId: number;
  /** The rev the tool ran against, as the page reported it. */
  rev: number | null;
}

/** Only a pending call ends, so a call is never ended twice. */
export function finishToolCall(db: Database, end: ToolCallEnd): void {
  db.prepare(
    `update tool_calls
        set status = ?, check_name = ?, result_message_id = ?, rev = ?, finished_at = ?
      where run_id = ? and call_id = ? and status = 'pending'`
  ).run(
    end.status,
    end.checkName ?? null,
    end.resultMessageId,
    end.rev,
    Date.now(),
    end.runId,
    end.callId
  );
}

interface PendingCall {
  id: number;
  call_id: string;
}

/**
 * Each of the run's pending calls gets an error result, so the log never holds a call
 * without its result: every provider refuses a conversation like that.
 */
export function closePendingCalls(db: Database, run: ConversationRun, content: string): void {
  const pending = db
    .prepare<[number], PendingCall>(
      `select id, call_id from tool_calls where run_id = ? and status = 'pending' order by id`
    )
    .all(run.runId);
  if (pending.length === 0) return;
  const body: ToolResultsMessageBody = {
    type: 'toolResults',
    results: pending.map((call) => ({ callId: call.call_id, content, isError: true })),
  };
  const result = appendMessage(db, { conversationId: run.conversationId, runId: run.runId, body });
  const close = db.prepare(
    `update tool_calls
        set status = 'error', check_name = 'interrupted', result_message_id = ?, finished_at = ?
      where id = ?`
  );
  for (const call of pending) close.run(result.id, Date.now(), call.id);
}

/** What a tool call ran against: the template its run worked on, and the rev. */
export interface ToolCallStamp {
  runId: number;
  callId: string;
  name: string;
  templateId: string | null;
  rev: number | null;
}

export function readToolCallStamps(db: Database, conversationId: number): ToolCallStamp[] {
  return db
    .prepare<[number], ToolCallStamp>(
      `select tool_calls.run_id as runId, call_id as callId, name,
              runs.template_id as templateId, tool_calls.rev as rev
         from tool_calls join runs on runs.id = tool_calls.run_id
        where runs.conversation_id = ?`
    )
    .all(conversationId);
}
