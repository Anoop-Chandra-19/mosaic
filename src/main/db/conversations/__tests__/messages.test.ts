import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { MessageBody } from '@shared/types/agentConversation';
import { openDatabase, type Database } from '../../connection';
import { createConversation } from '../conversations';
import { appendMessage, readMessagePage, readToolResult } from '../messages';

let db: Database;
let conversationId: number;

beforeEach(() => {
  db = openDatabase(':memory:');
  conversationId = createConversation(db, { provider: 'ollama', model: 'qwen3.5:9b' });
});

afterEach(() => db.close());

const userMessage = (text: string): MessageBody => ({
  type: 'user',
  text,
  resume: [],
  isLimit: false,
});

function appendUserMessages(count: number): void {
  for (let i = 1; i <= count; i++) {
    appendMessage(db, { conversationId, runId: null, body: userMessage(`message ${i}`) });
  }
}

const texts = (page: ReturnType<typeof readMessagePage>) =>
  page.map((message) => (message.body.type === 'user' ? message.body.text : message.body.type));

describe('appendMessage', () => {
  it('numbers messages in the order they are written', () => {
    const first = appendMessage(db, { conversationId, runId: null, body: userMessage('a') });
    const second = appendMessage(db, { conversationId, runId: null, body: userMessage('b') });
    expect([first.seq, second.seq]).toEqual([1, 2]);
  });

  it('numbers each conversation on its own', () => {
    const other = createConversation(db, { provider: 'ollama', model: 'qwen3.5:9b' });
    appendMessage(db, { conversationId, runId: null, body: userMessage('a') });
    expect(
      appendMessage(db, { conversationId: other, runId: null, body: userMessage('b') }).seq
    ).toBe(1);
  });

  it('refuses a body that isn’t a message, and writes nothing', () => {
    // The loop builds bodies partly from what the model sent, so a bad one can still arrive.
    const body = { type: 'user', text: 'no context' } as unknown as MessageBody;
    expect(() => appendMessage(db, { conversationId, runId: null, body })).toThrow(
      expect.objectContaining({ code: 'invalid-argument' })
    );
    expect(readMessagePage(db, conversationId, { limit: 10 })).toEqual([]);
  });

  it('refuses a missing conversation', () => {
    expect(() =>
      appendMessage(db, { conversationId: 999, runId: null, body: userMessage('a') })
    ).toThrow(expect.objectContaining({ code: 'not-found' }));
  });
});

describe('readMessagePage', () => {
  it('reads the newest page, oldest first', () => {
    appendUserMessages(5);
    expect(texts(readMessagePage(db, conversationId, { limit: 2 }))).toEqual([
      'message 4',
      'message 5',
    ]);
  });

  it('reads the page before a message, down to the first', () => {
    appendUserMessages(5);
    expect(texts(readMessagePage(db, conversationId, { beforeSeq: 4, limit: 2 }))).toEqual([
      'message 2',
      'message 3',
    ]);
    expect(texts(readMessagePage(db, conversationId, { beforeSeq: 2, limit: 2 }))).toEqual([
      'message 1',
    ]);
  });

  it('leaves out tool results’ content, which the Trace view loads one at a time', () => {
    const { id } = appendMessage(db, {
      conversationId,
      runId: null,
      body: {
        type: 'toolResults',
        results: [
          { callId: 'call-1', content: 'x'.repeat(10_000) },
          { callId: 'call-2', content: 'No such bullet.', isError: true },
        ],
      },
    });
    const [message] = readMessagePage(db, conversationId, { limit: 1 });
    expect(message.body).toEqual({
      type: 'toolResults',
      results: [
        { callId: 'call-1', isError: undefined },
        { callId: 'call-2', isError: true },
      ],
    });
    expect(readToolResult(db, id, 'call-2')).toEqual({
      callId: 'call-2',
      content: 'No such bullet.',
      isError: true,
    });
  });
});

describe('readToolResult', () => {
  it('refuses a call that message doesn’t answer', () => {
    const { id } = appendMessage(db, { conversationId, runId: null, body: userMessage('a') });
    expect(() => readToolResult(db, id, 'call-1')).toThrow(
      expect.objectContaining({ code: 'not-found' })
    );
  });
});
