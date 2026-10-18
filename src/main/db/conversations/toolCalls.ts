import type { Database } from 'better-sqlite3';

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
