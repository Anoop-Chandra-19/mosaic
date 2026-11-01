import type { Database } from 'better-sqlite3';
import type { RunStoppedMessageBody } from '@shared/types/agentConversation';
import type { ConversationPage, ConversationSummary } from '@shared/types/agentBridge';
import { StorageError } from '../storageError';
import { parseStoredMessageBody } from './storedMessageBody';

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

/** The conversation a run started in last, whichever template it was on; null for none yet. */
export function readLastConversationId(db: Database): number | null {
  return (
    db
      .prepare<[], number>('select id from conversations order by updated_at desc, id desc limit 1')
      .pluck()
      .get() ?? null
  );
}

/** Three lines of the widest pane, and no more: a pasted posting can be the whole first ask. */
const TITLE_LENGTH = 300;

/** For a query on `conversations c`: the start of the first thing asked. */
const TITLE_SQL = `(select substr(json_extract(m.body, '$.text'), 1, ${TITLE_LENGTH}) from messages m
  where m.conversation_id = c.id and m.type = 'user'
  order by m.seq limit 1)`;

/** Null for one with no words to use, or that isn't there. */
export function readConversationTitle(db: Database, conversationId: number): string | null {
  return (
    db
      .prepare<[number], string | null>(`select ${TITLE_SQL} from conversations c where c.id = ?`)
      .pluck()
      .get(conversationId) ?? null
  );
}

interface ConversationRow {
  id: number;
  title: string | null;
  last_active_at: number;
  /** A JSON array of names. */
  resumes: string;
  stop_body: string | null;
  provider: string;
  model: string;
}

function toConversationSummary(row: ConversationRow): ConversationSummary {
  return {
    id: row.id,
    title: row.title,
    lastActiveAt: row.last_active_at,
    resumes: JSON.parse(row.resumes) as string[],
    stop:
      row.stop_body === null
        ? null
        : {
            body: parseStoredMessageBody(row.stop_body) as RunStoppedMessageBody,
            runModel: { provider: row.provider, model: row.model },
          },
  };
}

/** A page of the conversations, most recently active first. */
export function readConversationPage(db: Database, page: ConversationPage): ConversationSummary[] {
  return db
    .prepare<[Record<string, unknown>], ConversationRow>(
      `select c.id, c.updated_at as last_active_at,
         ${TITLE_SQL} as title,
         (select json_group_array(name) from
            (select t.name from runs r join templates t on t.id = r.template_id
              where r.conversation_id = c.id
              group by t.id order by max(r.seq) desc)) as resumes,
         (select case when m.type = 'runStopped' then m.body end from messages m
            where m.conversation_id = c.id
            order by m.seq desc limit 1) as stop_body,
         c.provider, c.model
       from conversations c
       where @afterId is null or (c.updated_at, c.id) < (@afterAt, @afterId)
       order by c.updated_at desc, c.id desc
       limit @limit`
    )
    .all({
      afterAt: page.after?.lastActiveAt ?? null,
      afterId: page.after?.id ?? null,
      limit: page.limit,
    })
    .map(toConversationSummary);
}

/**
 * Removes a conversation and everything under it from the disk: the rows, then the pages they
 * sat on (`VACUUM`), then the write-ahead log that also held them. Once the rows are gone the
 * delete has happened, so a `VACUUM` that can't finish, on a full disk, doesn't undo it; the
 * next delete clears what it left.
 */
export function deleteConversation(db: Database, conversationId: number): void {
  const { changes } = db.prepare('delete from conversations where id = ?').run(conversationId);
  if (changes === 0) {
    throw new StorageError('not-found', `No conversation with id ${conversationId}`);
  }
  try {
    db.exec('vacuum');
    db.pragma('wal_checkpoint(truncate)');
  } catch (error) {
    console.warn('Couldn’t clear a deleted conversation from the disk yet.', error);
  }
}
