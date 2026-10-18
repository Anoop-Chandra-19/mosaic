import type { Database } from 'better-sqlite3';
import type { ToolResultsMessageBody } from '@shared/types/agentConversation';
import { appendMessage } from './messages';

const INTERRUPTED_RESULT = 'Mosaic closed before this tool finished.';

interface PendingCall {
  id: number;
  call_id: string;
}

/**
 * Each pending call gets an error result, so the log never holds a call without its
 * result: every provider refuses a conversation like that.
 */
function closePendingCalls(db: Database, run: { id: number; conversation_id: number }): void {
  const pending = db
    .prepare<[number], PendingCall>(
      `select id, call_id from tool_calls where run_id = ? and status = 'pending' order by id`
    )
    .all(run.id);
  if (pending.length === 0) return;
  const body: ToolResultsMessageBody = {
    type: 'toolResults',
    results: pending.map((call) => ({
      callId: call.call_id,
      content: INTERRUPTED_RESULT,
      isError: true,
    })),
  };
  const result = appendMessage(db, { conversationId: run.conversation_id, runId: run.id, body });
  const close = db.prepare(
    `update tool_calls
        set status = 'error', check_name = 'interrupted', result_message_id = ?, finished_at = ?
      where id = ?`
  );
  for (const call of pending) close.run(result.id, Date.now(), call.id);
}

/**
 * At boot, nothing is running: a run still marked running was cut off by a quit or a
 * crash, so it fails as interrupted. A message being edited in the box goes back to
 * waiting. A run waiting on the user's answer is left as it is.
 */
export function recoverInterruptedRuns(db: Database): void {
  db.transaction(() => {
    const cutOff = db
      .prepare<[], { id: number; conversation_id: number }>(
        `select id, conversation_id from runs where status = 'running'`
      )
      .all();
    for (const run of cutOff) closePendingCalls(db, run);
    db.prepare(
      `update runs set status = 'failed', error = 'interrupted', finished_at = ?
        where status = 'running'`
    ).run(Date.now());
    db.prepare(`update message_queue set state = 'waiting' where state = 'editing'`).run();
  })();
}
