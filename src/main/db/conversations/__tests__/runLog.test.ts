import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDefaultResume } from '@shared/resume/defaultResume';
import { openDatabase, type Database } from '../../connection';
import { createTemplate } from '../../resumes/templates';
import { createConversation } from '../conversations';
import { readConversationLog } from '../messages';
import type { ConversationRun } from '../runs';
import {
  endRun,
  failRun,
  startCarryOnRun,
  startUserRun,
  storeModelReply,
  storeToolAnswers,
  type RunStop,
} from '../runLog';
import { readToolCallStamps } from '../toolCalls';

let db: Database;
let conversationId: number;
let templateId: string;

beforeEach(() => {
  db = openDatabase(':memory:');
  conversationId = createConversation(db, { provider: 'ollama', model: 'qwen3.5:9b' });
  templateId = createTemplate(db, 'Platform, general', createDefaultResume()).id;
});

afterEach(() => db.close());

const bodies = () => readConversationLog(db, conversationId).map((message) => message.body);

const readRun = (id: number) =>
  db.prepare('select status, error, input_tokens, output_tokens from runs where id = ?').get(id);

const readToolCalls = () =>
  db.prepare('select call_id, status, check_name, rev from tool_calls order by id').all();

function ask(openId: string | null = templateId): ConversationRun {
  const { runId } = startUserRun(db, {
    conversationId,
    text: 'Tighten my summary.',
    templateId: openId,
    provider: 'ollama',
    model: 'qwen3.5:9b',
  });
  return { conversationId, runId };
}

function replyCalling(run: ConversationRun, callIds: string[]): void {
  storeModelReply(db, run, {
    parts: [
      { type: 'text', text: 'Looking.' },
      ...callIds.map((callId) => ({
        type: 'toolCall' as const,
        callId,
        name: 'read_document',
        args: {},
      })),
    ],
    usage: { inputTokens: 100, outputTokens: 10, cachedInputTokens: 80 },
    model: 'qwen3.5:9b',
    rev: 0,
  });
}

describe('a run in the log', () => {
  it('stores each step with its calls, and ends done with its tokens', () => {
    const { runId, template } = startUserRun(db, {
      conversationId,
      text: 'Tighten my summary.',
      templateId,
      provider: 'ollama',
      model: 'qwen3.5:9b',
    });
    expect(template).toEqual({ id: templateId, name: 'Platform, general', rev: 0 });
    const run = { conversationId, runId };

    replyCalling(run, ['c1']);
    expect(readToolCalls()).toEqual([
      { call_id: 'c1', status: 'pending', check_name: null, rev: 0 },
    ]);
    storeToolAnswers(db, run, [
      { callId: 'c1', content: 'Name: Ada Quill', isError: false, status: 'ok', rev: 1 },
    ]);
    endRun(db, run, undefined, { inputTokens: 100, outputTokens: 10, cachedInputTokens: 80 });

    expect(bodies().map((body) => body.type)).toEqual(['user', 'assistant', 'toolResults']);
    expect(readToolCalls()).toEqual([{ call_id: 'c1', status: 'ok', check_name: null, rev: 1 }]);
    expect(readToolCallStamps(db, conversationId)).toEqual([
      { runId, callId: 'c1', name: 'read_document', templateId, rev: 1 },
    ]);
    expect(readRun(runId)).toEqual({
      status: 'done',
      error: null,
      input_tokens: 100,
      output_tokens: 10,
    });
    const tokensOf = (table: string) =>
      db
        .prepare(`select cached_input_tokens from ${table} where cached_input_tokens is not null`)
        .all();
    expect(tokensOf('messages')).toEqual([{ cached_input_tokens: 80 }]);
    expect(tokensOf('runs')).toEqual([{ cached_input_tokens: 80 }]);
  });

  it('notes a switch of resume before the user’s message, never on the first run', () => {
    endRun(db, ask(), undefined, null);
    endRun(db, ask(null), undefined, null);
    const other = createTemplate(db, 'Data, senior', createDefaultResume()).id;
    endRun(db, ask(other), undefined, null);

    expect(bodies().slice(-2)).toEqual([
      { type: 'templateSwitched', templateId: other, label: 'Data, senior' },
      { type: 'user', text: 'Tighten my summary.', resume: [], isLimit: false },
    ]);
    expect(bodies().filter((body) => body.type === 'templateSwitched')).toHaveLength(1);
  });

  it('carries on with no message of its own, noting a switch of resume, never first', () => {
    const carryOn = (openId: string) =>
      startCarryOnRun(db, { conversationId, templateId: openId, provider: 'ollama', model: 'm' });
    expect(() => carryOn(templateId)).toThrow('has no run to carry on from');

    endRun(db, ask(), { reason: 'connection' }, null);
    endRun(db, { conversationId, runId: carryOn(templateId).runId }, undefined, null);
    const other = createTemplate(db, 'Data, senior', createDefaultResume()).id;
    carryOn(other);

    expect(bodies().map((body) => body.type)).toEqual(['user', 'runStopped', 'templateSwitched']);
  });

  it('starts a new conversation, or none if the run can’t start', () => {
    const start = (openId: string) =>
      startUserRun(db, {
        conversationId: null,
        text: 'Hi.',
        templateId: openId,
        provider: 'ollama',
        model: 'm',
      });
    expect(() => start('no-such-template')).toThrow();
    const { conversationId: started } = start(templateId);
    expect(started).toBe(conversationId + 1);
    expect(readConversationLog(db, started).map((message) => message.body.type)).toEqual(['user']);
  });

  it('writes nothing of a reply it can’t store whole', () => {
    const run = ask();
    expect(() => replyCalling(run, ['c1', 'c1'])).toThrow();
    expect(bodies().map((body) => body.type)).toEqual(['user']);
    expect(readToolCalls()).toEqual([]);
  });
});

describe('a run’s stop', () => {
  it.each<[RunStop, { status: string; error: string | null }]>([
    [
      {
        reason: 'connection',
        providerError: { reason: 'failed', message: 'Bad gateway', httpStatus: 502 },
        attempts: 4,
        waitedMs: 21_000,
      },
      { status: 'failed', error: 'connection' },
    ],
    [{ reason: 'stepLimit' }, { status: 'step_limit', error: 'stepLimit' }],
    [{ reason: 'cancelled' }, { status: 'cancelled', error: null }],
  ])('stores %o with the status it ends as', (stop, end) => {
    const run = ask();
    endRun(db, run, stop, null);
    expect(bodies().at(-1)).toEqual({ type: 'runStopped', ...stop });
    expect(readRun(run.runId)).toMatchObject(end);
  });

  it('answers the calls a fault in Mosaic left, and stores the fault', () => {
    const run = ask();
    replyCalling(run, ['c1', 'c2']);
    failRun(db, run, 'Error: broken view', null);

    expect(bodies().slice(-2)).toEqual([
      {
        type: 'toolResults',
        results: [
          { callId: 'c1', content: 'The tool was not run.', isError: true },
          { callId: 'c2', content: 'The tool was not run.', isError: true },
        ],
      },
      { type: 'runStopped', reason: 'appFault', detail: 'Error: broken view' },
    ]);
    expect(readRun(run.runId)).toMatchObject({ status: 'failed', error: 'appFault' });
    expect(readToolCalls()).toMatchObject([{ status: 'error' }, { status: 'error' }]);
  });
});
