import type { Database } from 'better-sqlite3';
import type { ConversationRun } from './runs';
import { closePendingCalls } from './toolCalls';

const INTERRUPTED_RESULT = 'Mosaic closed before this tool finished.';

/**
 * At boot, nothing is running: a run still marked running was cut off by a quit or a
 * crash, so it fails as interrupted. A message being edited in the box goes back to
 * waiting. A run waiting on the user's answer is left as it is.
 */
export function recoverInterruptedRuns(db: Database): void {
  db.transaction(() => {
    const cutOff = db
      .prepare<[], ConversationRun>(
        `select id as runId, conversation_id as conversationId from runs where status = 'running'`
      )
      .all();
    for (const run of cutOff) closePendingCalls(db, run, INTERRUPTED_RESULT);
    db.prepare(
      `update runs set status = 'failed', error = 'interrupted', finished_at = ?
        where status = 'running'`
    ).run(Date.now());
    db.prepare(`update message_queue set state = 'waiting' where state = 'editing'`).run();
  })();
}
