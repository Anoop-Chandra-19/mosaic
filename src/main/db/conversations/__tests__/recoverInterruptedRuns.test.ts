import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type Database } from '../../connection';
import { createConversation } from '../conversations';
import { appendMessage, readMessagePage, readToolResult } from '../messages';
import { recoverInterruptedRuns } from '../recoverInterruptedRuns';
import { finishRun, startRun } from '../runs';
import { recordToolCall } from '../toolCalls';

let db: Database;
let conversationId: number;

beforeEach(() => {
  db = openDatabase(':memory:');
  conversationId = createConversation(db, { provider: 'ollama', model: 'm' });
});

afterEach(() => db.close());

function startRunAskingFor(callIds: string[]): number {
  const run = startRun(db, { conversationId, templateId: null, provider: 'ollama', model: 'm' });
  const request = appendMessage(db, {
    conversationId,
    runId: run.id,
    body: {
      type: 'assistant',
      content: callIds.map((callId) => ({
        type: 'toolCall',
        callId,
        name: 'read_document',
        args: {},
      })),
    },
  });
  for (const callId of callIds) {
    recordToolCall(db, {
      runId: run.id,
      requestMessageId: request.id,
      callId,
      name: 'read_document',
      rev: null,
    });
  }
  return run.id;
}

function queueMessage(id: string, position: number, state: 'waiting' | 'editing'): void {
  db.prepare(
    `insert into message_queue (id, conversation_id, position, body, delivery, state, created_at)
     values (?, ?, ?, ?, 'step', ?, 0)`
  ).run(
    id,
    conversationId,
    position,
    JSON.stringify({ type: 'user', text: id, resume: [], isLimit: false }),
    state
  );
}

describe('recoverInterruptedRuns', () => {
  it('fails a cut-off run and answers its pending calls, so the log stays valid', () => {
    const runId = startRunAskingFor(['call-1', 'call-2']);

    recoverInterruptedRuns(db);

    expect(db.prepare('select status, error from runs where id = ?').get(runId)).toEqual({
      status: 'failed',
      error: 'interrupted',
    });
    const last = readMessagePage(db, conversationId, { limit: 1 })[0];
    expect(last.body).toEqual({
      type: 'toolResults',
      results: [
        { callId: 'call-1', isError: true, checkName: 'interrupted' },
        { callId: 'call-2', isError: true, checkName: 'interrupted' },
      ],
    });
    expect(readToolResult(db, last.id, 'call-1').content).toMatch(/closed/);
    expect(db.prepare('select distinct status, check_name from tool_calls').all()).toEqual([
      { status: 'error', check_name: 'interrupted' },
    ]);
  });

  it('leaves finished runs alone', () => {
    const runId = startRunAskingFor([]);
    finishRun(db, runId, { status: 'done' });

    recoverInterruptedRuns(db);

    expect(db.prepare('select status from runs').pluck().get()).toBe('done');
    expect(readMessagePage(db, conversationId, { limit: 10 })).toHaveLength(1);
  });

  it('puts a message being edited back to waiting', () => {
    queueMessage('a', 1, 'waiting');
    queueMessage('b', 2, 'editing');

    recoverInterruptedRuns(db);

    expect(db.prepare('select id, state from message_queue order by position').all()).toEqual([
      { id: 'a', state: 'waiting' },
      { id: 'b', state: 'waiting' },
    ]);
  });
});
