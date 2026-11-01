import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { MessageBody } from '@shared/types/agentConversation';
import { openDatabase, type Database } from '../../connection';
import { createConversation } from '../conversations';
import { appendMessage, readConversationLog, readMessagePage, readToolResult } from '../messages';
import { startUserRun } from '../runLog';

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

  it('names the provider and model of the run each message is in', () => {
    appendUserMessages(1);
    startUserRun(db, {
      conversationId,
      templateId: null,
      provider: 'anthropic',
      model: 'claude-sonnet-5-5',
      text: 'Tighten my summary.',
    });
    expect(readMessagePage(db, conversationId, { limit: 2 }).map((each) => each.runModel)).toEqual([
      null,
      { provider: 'anthropic', model: 'claude-sonnet-5-5' },
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

  it('gives what a request used, only when its provider said', () => {
    const body: MessageBody = { type: 'assistant', content: [] };
    appendMessage(db, { conversationId, runId: null, body });
    appendMessage(db, {
      conversationId,
      runId: null,
      body,
      inputTokens: 1204,
      outputTokens: 80,
    });
    appendMessage(db, {
      conversationId,
      runId: null,
      body,
      inputTokens: 1204,
      cachedInputTokens: 1000,
      outputTokens: 80,
    });
    expect(readMessagePage(db, conversationId, { limit: 3 }).map(({ usage }) => usage)).toEqual([
      undefined,
      { inputTokens: 1204, outputTokens: 80 },
      { inputTokens: 1204, cachedInputTokens: 1000, outputTokens: 80 },
    ]);
  });

  it('gives thinking its duration and length only, keeping the rest for the next request', () => {
    const reasoning = {
      type: 'reasoning',
      text: 'The summary repeats the first bullet.',
      durationMs: 3400,
      providerState: { type: 'reasoning', encrypted_content: 'gAAAAB-opaque' },
    } as const;
    const body: MessageBody = {
      type: 'assistant',
      content: [reasoning, { type: 'text', text: 'Tightened it.' }],
      finish: 'complete',
    };
    appendMessage(db, { conversationId, runId: null, body });

    expect(readMessagePage(db, conversationId, { limit: 1 })[0].body).toEqual({
      type: 'assistant',
      content: [
        { type: 'reasoning', durationMs: 3400, textLength: reasoning.text.length },
        { type: 'text', text: 'Tightened it.' },
      ],
      finish: 'complete',
    });
    expect(readConversationLog(db, conversationId)[0].body).toEqual(body);
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
