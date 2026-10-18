import type { Database } from 'better-sqlite3';

/*
 * The assistant's conversations: a conversation holds runs, and each run appends to the
 * conversation's message log and records its tool calls. Others use this file, `runs`,
 * `messages`, `toolCalls` and `recoverInterruptedRuns` (at boot). Every body written goes
 * through `storedMessageBody`, which checks it with `validateMessageBody`.
 */

export interface NewConversation {
  provider: string;
  model: string;
}

export function createConversation(db: Database, conversation: NewConversation): number {
  const now = Date.now();
  const { lastInsertRowid } = db
    .prepare(
      `insert into conversations (provider, model, created_at, updated_at)
       values (?, ?, ?, ?)`
    )
    .run(conversation.provider, conversation.model, now, now);
  return Number(lastInsertRowid);
}
