import type { Database } from 'better-sqlite3';
import type {
  MessageBody,
  ToolResult,
  TranscriptMessage,
  TranscriptMessageBody,
} from '@shared/types/agentConversation';
import { StorageError } from '../storageError';
import { encodeStoredMessageBody, parseStoredMessageBody } from './storedMessageBody';

export interface NewMessage {
  conversationId: number;
  /** Null for one written outside a run. */
  runId: number | null;
  body: MessageBody;
  /** Assistant messages: the model that wrote it, and the tokens its request used. */
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
}

export interface AppendedMessage {
  id: number;
  seq: number;
}

/** Appends to the end of the log; the conversation becomes the last one used. */
export function appendMessage(db: Database, message: NewMessage): AppendedMessage {
  const body = encodeStoredMessageBody(message.body);
  return db.transaction(() => {
    const now = Date.now();
    const { changes } = db
      .prepare('update conversations set updated_at = ? where id = ?')
      .run(now, message.conversationId);
    if (changes === 0) {
      throw new StorageError('not-found', `No conversation with id ${message.conversationId}`);
    }
    return db
      .prepare<[Record<string, unknown>], AppendedMessage>(
        `insert into messages
           (conversation_id, seq, run_id, type, body, model, input_tokens, output_tokens, created_at)
         values (@conversationId,
                 (select coalesce(max(seq), 0) + 1 from messages where conversation_id = @conversationId),
                 @runId, @type, @body, @model, @inputTokens, @outputTokens, @now)
         returning id, seq`
      )
      .get({
        conversationId: message.conversationId,
        runId: message.runId,
        type: message.body.type,
        body,
        model: message.model ?? null,
        inputTokens: message.inputTokens ?? null,
        outputTokens: message.outputTokens ?? null,
        now,
      })!;
  })();
}

interface MessageRow {
  id: number;
  seq: number;
  run_id: number | null;
  body: string;
  created_at: number;
}

function toTranscriptBody(body: MessageBody): TranscriptMessageBody {
  if (body.type !== 'toolResults') return body;
  const results = body.results.map(({ callId, isError }) => ({ callId, isError }));
  return { type: 'toolResults', results };
}

export interface MessagePage {
  /** The page ends just before this message; absent for the newest page. */
  beforeSeq?: number;
  limit: number;
}

/**
 * A page of the transcript, oldest first: the newest `limit` messages, or the `limit`
 * before `beforeSeq`. The renderer never holds a whole conversation, only pages near
 * what's on screen.
 */
export function readMessagePage(
  db: Database,
  conversationId: number,
  page: MessagePage
): TranscriptMessage[] {
  const rows = db
    .prepare<[number, number, number], MessageRow>(
      `select id, seq, run_id, body, created_at from messages
        where conversation_id = ? and seq < ?
        order by seq desc limit ?`
    )
    .all(conversationId, page.beforeSeq ?? Number.MAX_SAFE_INTEGER, page.limit);
  return rows.reverse().map((row) => ({
    id: row.id,
    seq: row.seq,
    runId: row.run_id,
    body: toTranscriptBody(parseStoredMessageBody(row.body)),
    createdAt: row.created_at,
  }));
}

/** One tool result in full, for the Trace view. */
export function readToolResult(db: Database, messageId: number, callId: string): ToolResult {
  const result = db
    .prepare<[number, string], string>(
      `select result.value from messages, json_each(messages.body, '$.results') result
        where messages.id = ? and messages.type = 'toolResults'
          and json_extract(result.value, '$.callId') = ?`
    )
    .pluck()
    .get(messageId, callId);
  if (result === undefined) {
    throw new StorageError('not-found', `No result for ${callId} in message ${messageId}`);
  }
  return JSON.parse(result) as ToolResult;
}
