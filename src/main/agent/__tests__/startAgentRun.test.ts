import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RUN_LIMITS } from '@shared/agent/runLimitSettings';
import { createDefaultResume } from '@shared/resume/defaultResume';
import type { AgentRunEvent } from '@shared/types/agentRunEvents';
import type { ModelStreamEvent } from '@shared/types/modelReply';
import { openDatabase, type Database } from '../../db/connection';
import { createConversation } from '../../db/conversations/conversations';
import { readConversationLog } from '../../db/conversations/messages';
import { createTemplate } from '../../db/resumes/templates';
import { STALE_READ } from '../assembleModelContext';
import { startAgentRun, type AgentRunRequest } from '../startAgentRun';
import { REPEAT_WARNING } from '../runLimits';
import {
  callTool,
  DONE,
  fakePage,
  hang,
  ok,
  refused,
  say,
  scriptedModel,
  type PageAnswer,
  type ScriptedReply,
} from './scriptedRun';

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

const doneReadingCache = (cachedInputTokens: number): ModelStreamEvent => ({
  type: 'finish',
  reason: 'complete',
  usage: { inputTokens: 100, outputTokens: 10, cachedInputTokens },
});

const readToolCalls = () =>
  db.prepare('select call_id, status, check_name from tool_calls order by id').all();

interface Ask {
  replies: ScriptedReply[];
  answer?: (call: { name: string; args: unknown }) => PageAnswer | Promise<PageAnswer>;
  overrides?: Partial<AgentRunRequest>;
}

function ask({ replies, answer = () => ok('Done.'), overrides }: Ask) {
  const model = scriptedModel(replies);
  const page = fakePage(answer, { templateId, rev: 0 });
  const events: AgentRunEvent[] = [];
  const { ended: run } = startAgentRun({
    db,
    ask: { type: 'user', conversationId, text: 'Tighten my summary.' },
    templateId,
    model: { provider: 'ollama', name: 'qwen3.5:9b' },
    modelProvider: model.provider,
    bridge: page.bridge,
    signal: new AbortController().signal,
    onEvent: (event) => events.push(event),
    wait: async () => {},
    ...overrides,
  });
  return { run, model, page, events };
}

describe('a run', () => {
  it('reads, proposes, repairs a refusal, finishes, and notes a switch of resume next time', async () => {
    const { run, model, events } = ask({
      replies: [
        [callTool('c1', 'read_document'), DONE],
        [callTool('c2', 'propose_rewrite', { id: 'b9' }), DONE],
        [callTool('c3', 'propose_rewrite', { id: 'b1' }), doneReadingCache(70)],
        [say('I suggested a tighter first bullet.'), doneReadingCache(80)],
      ],
      answer: (call) =>
        (call.args as { id?: string }).id === 'b9' ? refused('There is no b9.') : ok('Answered.'),
    });

    expect(await run).toEqual({ stopReason: undefined });
    expect(bodies().map((body) => body.type)).toEqual([
      'user',
      'assistant',
      'toolResults',
      'assistant',
      'toolResults',
      'assistant',
      'toolResults',
      'assistant',
    ]);
    expect(readRun(1)).toEqual({
      status: 'done',
      error: null,
      input_tokens: 400,
      output_tokens: 40,
    });
    // Counted from the steps that said; the first two didn't.
    expect(db.prepare('select cached_input_tokens from runs where id = 1').get()).toEqual({
      cached_input_tokens: 150,
    });
    expect(model.requests[0].system).toContain('The open resume is “Platform, general”.');
    expect(model.requests[2].messages.at(-1)).toMatchObject({
      content: 'There is no b9.',
      isError: true,
    });
    expect(events.at(-1)).toEqual({ type: 'runEnded', stopReason: undefined });

    const other = createTemplate(db, 'Data, senior', createDefaultResume()).id;
    await ask({ replies: [[say('Hi.'), DONE]], overrides: { templateId: other } }).run;
    // No step said: unknown, not zero.
    expect(db.prepare('select cached_input_tokens from runs where id = 2').get()).toEqual({
      cached_input_tokens: null,
    });
    expect(bodies().filter((body) => body.type === 'templateSwitched')).toEqual([
      {
        type: 'templateSwitched',
        templateId: other,
        label: 'Data, senior',
        previousId: templateId,
      },
    ]);
  });

  it('tells the model to read again once the resume has changed under its read', async () => {
    let rev = 0;
    const { run, model } = ask({
      replies: [
        [callTool('c1', 'read_document'), DONE],
        [callTool('c2', 'propose_rewrite'), DONE],
        [DONE],
      ],
      answer: () => ({ content: 'Answered.', isError: false, draft: { templateId, rev: rev++ } }),
    });
    await run;
    const results = model.requests[2].messages.filter((message) => message.role === 'toolResult');
    expect(results).toMatchObject([{ content: STALE_READ }, { content: 'Answered.' }]);
  });

  it('carries on from the log with no new message', async () => {
    const { run } = ask({
      replies: [[{ type: 'error', error: { reason: 'keyRefused', httpStatus: 401 } }]],
    });
    expect(await run).toEqual({ stopReason: 'providerError', providerErrorReason: 'keyRefused' });

    const carryOn = ask({
      replies: [[say('Here it is.'), DONE]],
      overrides: { ask: { type: 'carryOn', conversationId } },
    });
    expect(await carryOn.run).toEqual({ stopReason: undefined });
    expect(carryOn.model.requests[0].messages).toEqual([
      { role: 'user', text: 'Tighten my summary.' },
    ]);
    expect(bodies().map((body) => body.type)).toEqual(['user', 'runStopped', 'assistant']);
  });

  it('carries on when a tool does not answer in time', async () => {
    const { run } = ask({
      replies: [
        [callTool('c1', 'read_document'), DONE],
        [say('Sorry.'), DONE],
      ],
      answer: () => new Promise<PageAnswer>(() => {}),
      overrides: { limits: { ...RUN_LIMITS, toolAnswerMs: 10 } },
    });
    expect(await run).toEqual({ stopReason: undefined });
    expect(readToolCalls()).toEqual([{ call_id: 'c1', status: 'error', check_name: 'timeout' }]);
  });
});

describe('stopping a run', () => {
  it('stores a stop layer’s stop, answering the calls it left', async () => {
    const reorder = (id: string) => callTool(id, 'propose_reorder', { order: ['e1', 'b3'] });
    const { run, model } = ask({
      replies: [
        [reorder('c1'), DONE],
        [reorder('c2'), DONE],
        [reorder('c3'), callTool('c4', 'read_document'), DONE],
      ],
      answer: () => refused('order mixes lists'),
    });

    expect(await run).toEqual({ stopReason: 'repeatedCall' });
    expect(model.requests[2].messages.at(-1)).toMatchObject({
      content: `order mixes lists\n${REPEAT_WARNING}`,
    });
    expect(bodies().slice(-2)).toEqual([
      {
        type: 'toolResults',
        results: [
          {
            callId: 'c3',
            content: 'order mixes lists',
            isError: true,
            durationMs: expect.any(Number),
            startedAt: expect.any(Number),
          },
          { callId: 'c4', content: 'Not run: the run stopped.', isError: true, notRun: true },
        ],
      },
      { type: 'runStopped', reason: 'repeatedCall', detail: 'order mixes lists' },
    ]);
    expect(readRun(1)).toMatchObject({ status: 'failed', error: 'repeatedCall' });
  });

  it('lets the model hear a step’s refusals, however many calls it made', async () => {
    const rewrites = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'].map((id) =>
      callTool(id, 'propose_rewrite', { id: 'b1', text: id })
    );
    const { run, model } = ask({
      replies: [
        [...rewrites, DONE],
        [{ type: 'textDelta', text: 'I’ll read it first.' }, DONE],
      ],
      answer: () => refused('Read the resume first, with read_document.'),
    });

    expect(await run).toEqual({ stopReason: undefined });
    expect(model.requests).toHaveLength(2);
  });

  it('stops at the step limit', async () => {
    const step = (id: string) => [callTool(id, 'read_document'), DONE];
    const { run, model } = ask({
      replies: [step('c1'), step('c2'), step('c3')],
      overrides: { limits: { ...RUN_LIMITS, steps: 2 } },
    });
    expect(await run).toEqual({ stopReason: 'stepLimit' });
    expect(model.requests).toHaveLength(2);
    expect(readRun(1)).toMatchObject({ status: 'step_limit' });
  });

  it('keeps the text a stopped reply had streamed, without its unanswered calls', async () => {
    const stop = new AbortController();
    const { run } = ask({
      replies: [
        (request) => ({
          async *[Symbol.asyncIterator]() {
            yield say('Looking at');
            yield callTool('c1', 'read_document');
            stop.abort();
            yield* hang(request);
          },
        }),
      ],
      overrides: { signal: stop.signal },
    });

    expect(await run).toEqual({ stopReason: 'cancelled' });
    expect(bodies().slice(1)).toEqual([
      { type: 'assistant', content: [{ type: 'text', text: 'Looking at' }] },
      { type: 'runStopped', reason: 'cancelled' },
    ]);
    expect(readRun(1)).toMatchObject({ status: 'cancelled', error: null });
  });

  it('answers the calls a Stop during the tool round left', async () => {
    const stop = new AbortController();
    const { run, page } = ask({
      replies: [[callTool('c1', 'read_document'), callTool('c2', 'read_document'), DONE]],
      overrides: {
        signal: stop.signal,
        onEvent: (event) => {
          if (event.type === 'toolResult') stop.abort();
        },
      },
    });

    expect(await run).toEqual({ stopReason: 'cancelled' });
    expect(page.calls).toHaveLength(1);
    expect(readToolCalls()).toEqual([
      { call_id: 'c1', status: 'ok', check_name: null },
      { call_id: 'c2', status: 'cancelled', check_name: 'cancelled' },
    ]);
  });

  it('stores a stop for a fault in Mosaic itself, with its calls answered', async () => {
    const { run } = ask({
      replies: [[callTool('c1', 'read_document'), DONE]],
      overrides: {
        onEvent: (event) => {
          if (event.type === 'toolResult') throw new Error('broken view');
        },
      },
    });
    await expect(run).rejects.toThrow('broken view');
    expect(readRun(1)).toMatchObject({ status: 'failed', error: 'appFault' });
    expect(bodies().slice(-2)).toEqual([
      {
        type: 'toolResults',
        results: [{ callId: 'c1', content: 'The tool was not run.', isError: true }],
      },
      {
        type: 'runStopped',
        reason: 'appFault',
        detail: expect.stringMatching(/^Error: broken view\n\s+at .*startAgentRun\.test\.ts/),
      },
    ]);
  });
});
