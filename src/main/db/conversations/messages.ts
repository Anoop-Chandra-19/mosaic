import type { Database } from 'better-sqlite3';
import type {
  MessageBody,
  ToolResult,
  TranscriptMessage,
  TranscriptMessageBody,
  TranscriptReplyPart,
} from '@shared/types/agentConversation';
import type { MessagePage } from '@shared/types/agentBridge';
import type { ModelReplyPart } from '@shared/types/modelReply';
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
  cachedInputTokens?: number;
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
           (conversation_id, seq, run_id, type, body, model,
            input_tokens, cached_input_tokens, output_tokens, created_at)
         values (@conversationId,
                 (select coalesce(max(seq), 0) + 1 from messages where conversation_id = @conversationId),
                 @runId, @type, @body, @model,
                 @inputTokens, @cachedInputTokens, @outputTokens, @now)
         returning id, seq`
      )
      .get({
        conversationId: message.conversationId,
        runId: message.runId,
        type: message.body.type,
        body,
        model: message.model ?? null,
        inputTokens: message.inputTokens ?? null,
        cachedInputTokens: message.cachedInputTokens ?? null,
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

/** Null provider and model for a message written outside a run. */
interface TranscriptRow extends MessageRow {
  provider: string | null;
  model: string | null;
}

/** Only what the pane shows; the rest stays in main rather than in the window's memory. */
function toTranscriptBody(body: MessageBody): TranscriptMessageBody {
  switch (body.type) {
    case 'assistant':
      return { ...body, content: body.content.map(toTranscriptReplyPart) };
    case 'toolResults':
      return {
        type: 'toolResults',
        results: body.results.map(({ callId, isError }) => ({ callId, isError })),
      };
    default:
      return body;
  }
}

function toTranscriptReplyPart(part: ModelReplyPart): TranscriptReplyPart {
  if (part.type !== 'reasoning') return part;
  return { type: 'reasoning', durationMs: part.durationMs };
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
    .prepare<[number, number, number], TranscriptRow>(
      `select m.id, m.seq, m.run_id, m.body, m.created_at, r.provider, r.model
         from messages m left join runs r on r.id = m.run_id
        where m.conversation_id = ? and m.seq < ?
        order by m.seq desc limit ?`
    )
    .all(conversationId, page.beforeSeq ?? Number.MAX_SAFE_INTEGER, page.limit);
  return rows.reverse().map((row) => ({
    id: row.id,
    seq: row.seq,
    runId: row.run_id,
    runModel:
      row.provider === null || row.model === null
        ? null
        : { provider: row.provider, model: row.model },
    body: toTranscriptBody(parseStoredMessageBody(row.body)),
    createdAt: row.created_at,
  }));
}

export interface LoggedMessage {
  seq: number;
  runId: number | null;
  body: MessageBody;
}

/** The whole log in full, oldest first: what the next request is built from. */
export function readConversationLog(db: Database, conversationId: number): LoggedMessage[] {
  return db
    .prepare<[number], Pick<MessageRow, 'seq' | 'run_id' | 'body'>>(
      'select seq, run_id, body from messages where conversation_id = ? order by seq'
    )
    .all(conversationId)
    .map((row) => ({ seq: row.seq, runId: row.run_id, body: parseStoredMessageBody(row.body) }));
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
