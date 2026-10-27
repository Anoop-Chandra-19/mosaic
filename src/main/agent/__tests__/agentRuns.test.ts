import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultResume } from '@shared/resume/defaultResume';
import type { AgentRunEnvelope, AgentToolAnswer, AgentToolCall } from '@shared/types/agentBridge';
import { AGENT_SETTINGS_KEY } from '@shared/types/modelProviders';
import { openDatabase, type Database } from '../../db/connection';
import { readConversationLog } from '../../db/conversations/messages';
import { createTemplate } from '../../db/resumes/templates';
import { setSetting } from '../../db/settings';
import { createAgentRuns, type AgentRuns, type RunPage } from '../agentRuns';
import { RUN_LIMITS } from '../runLimits';
import { callTool, DONE, hang, say, scriptedModel, type ScriptedReply } from './scriptedRun';

let db: Database;
let templateId: string;

const storeSettings = (state: Record<string, unknown>) =>
  setSetting(
    db,
    AGENT_SETTINGS_KEY,
    JSON.stringify({
      state: {
        enabled: true,
        provider: 'ollama',
        modelsByProvider: { ollama: 'qwen3.5:9b', openai: 'gpt-5.6-terra' },
        ollamaAddress: 'http://127.0.0.1:11434',
        ollamaContextTokens: null,
        ...state,
      },
      version: 0,
    })
  );

beforeEach(() => {
  db = openDatabase(':memory:');
  templateId = createTemplate(db, 'Platform, general', createDefaultResume()).id;
  storeSettings({});
});

afterEach(() => db.close());

const answered = (content: string): AgentToolAnswer => ({
  ok: true,
  result: { content, isError: false, draft: { templateId, rev: 0 } },
});

interface Setup {
  replies: ScriptedReply[];
  /** How the page answers each call; left out, it never does. */
  answer?: (call: AgentToolCall, runs: AgentRuns) => void;
  toolAnswerMs?: number;
  /** Held until the test lets it go, as a keychain prompt would hold it. */
  providerOpened?: Promise<void>;
}

function setUp({ replies, answer, toolAnswerMs = RUN_LIMITS.toolAnswerMs, providerOpened }: Setup) {
  const model = scriptedModel(replies);
  const envelopes: AgentRunEnvelope[] = [];
  const runs = createAgentRuns({
    currentDb: () => db,
    createProvider: async (choice) => {
      await providerOpened;
      return choice.provider === 'ollama'
        ? { ok: true, modelProvider: model.provider }
        : { ok: false, reason: 'noApiKey' };
    },
    limits: { ...RUN_LIMITS, toolAnswerMs },
    wait: async () => {},
  });
  let hearEnd = () => {};
  const ended = new Promise<void>((resolve) => (hearEnd = resolve));
  const goneWatchers = new Set<() => void>();
  const page: RunPage = {
    sendEvent: (envelope) => {
      envelopes.push(envelope);
      if (envelope.event.type === 'runEnded') hearEnd();
    },
    sendToolCall: (call) => queueMicrotask(() => answer?.(call, runs)),
    watchGone: (onGone) => {
      goneWatchers.add(onGone);
      return () => goneWatchers.delete(onGone);
    },
  };
  const ask = () =>
    runs.start(page, { conversationId: null, text: 'Tighten my summary.', templateId });
  const reloadPage = () => goneWatchers.forEach((onGone) => onGone());
  return { runs, ask, ended, envelopes, reloadPage, goneWatchers };
}

describe('a run started from the page', () => {
  it('runs to its end in a new conversation, its events numbered, its calls answered', async () => {
    const { ask, ended, envelopes } = setUp({
      replies: [
        [callTool('c1', 'read_document'), DONE],
        [say('Done.'), DONE],
      ],
      answer: (call, runs) => runs.answerTool(call.runId, call.callId, answered('Name: Ada')),
    });

    const start = await ask();
    expect(start).toEqual({ ok: true, conversationId: 1, runId: 1 });
    await ended;

    expect(envelopes.map(({ seq, event }) => `${seq} ${event.type}`)).toEqual([
      '1 stepStarted',
      '2 toolCall',
      '3 toolResult',
      '4 stepStarted',
      '5 textDelta',
      '6 runEnded',
    ]);
    expect(envelopes.every((envelope) => envelope.runId === 1)).toBe(true);
    expect(readConversationLog(db, 1).map((message) => message.body.type)).toEqual([
      'user',
      'assistant',
      'toolResults',
      'assistant',
    ]);
  });

  it('refuses a start while the assistant is off, its provider refuses, or a run is starting or going', async () => {
    const { ask } = setUp({ replies: [hang] });
    storeSettings({ enabled: false });
    expect(await ask()).toEqual({ ok: false, reason: 'assistantOff' });
    storeSettings({ provider: 'openai' });
    expect(await ask()).toEqual({ ok: false, reason: 'noApiKey' });
    storeSettings({});
    const first = ask();
    expect(await ask()).toEqual({ ok: false, reason: 'runInProgress' });
    expect(await first).toMatchObject({ ok: true });
    expect(await ask()).toEqual({ ok: false, reason: 'runInProgress' });
  });

  it('refuses a start still waiting for its provider when Erase stops everything', async () => {
    let openProvider = () => {};
    const providerOpened = new Promise<void>((resolve) => (openProvider = resolve));
    const { runs, ask, envelopes } = setUp({ replies: [hang], providerOpened });
    const start = ask();
    const stopped = runs.stopAll();
    openProvider();

    expect(await start).toEqual({ ok: false, reason: 'assistantOff' });
    await stopped;
    expect(envelopes).toEqual([]);
  });

  it('stops on Stop, and takes the next start once the end is stored', async () => {
    const { runs, ask, envelopes } = setUp({ replies: [hang, [say('Hi.'), DONE]] });
    const start = await ask();
    if (!start.ok) throw new Error('did not start');
    runs.stop(start.runId + 1);
    runs.stop(start.runId);
    await runs.stopAll();

    expect(envelopes.at(-1)?.event).toEqual({ type: 'runEnded', stopReason: 'cancelled' });
    expect(await ask()).toMatchObject({ ok: true, runId: 2 });
  });

  it('stops when its page reloads or closes, and stops watching the page once ended', async () => {
    const { runs, ask, envelopes, reloadPage, goneWatchers } = setUp({ replies: [hang] });
    await ask();
    expect(goneWatchers.size).toBe(1);
    reloadPage();
    await runs.stopAll();

    expect(envelopes.at(-1)?.event).toEqual({ type: 'runEnded', stopReason: 'cancelled' });
    expect(goneWatchers.size).toBe(0);
  });

  it('drops an answer that comes after the call’s deadline, and fails a call that threw', async () => {
    const late: AgentToolCall[] = [];
    const { runs, ask, ended } = setUp({
      replies: [
        [callTool('c1', 'read_document'), DONE],
        [callTool('c2', 'read_document'), DONE],
        [DONE],
      ],
      answer: (call) => {
        if (call.callId === 'c1') late.push(call);
        else runs.answerTool(call.runId, call.callId, { ok: false, message: 'Error: no view' });
      },
      toolAnswerMs: 5,
    });
    await ask();
    await ended;
    runs.answerTool(late[0].runId, late[0].callId, answered('Too late.'));

    const results = readConversationLog(db, 1).filter(({ body }) => body.type === 'toolResults');
    expect(results.map(({ body }) => body)).toEqual([
      {
        type: 'toolResults',
        results: [{ callId: 'c1', content: 'The tool did not answer in time.', isError: true }],
      },
      {
        type: 'toolResults',
        results: [{ callId: 'c2', content: 'The tool failed: Error: no view', isError: true }],
      },
    ]);
  });

  it('tells the page a run ended when a fault in Mosaic ended it', async () => {
    const { ask, ended, envelopes } = setUp({ replies: [] });
    const report = vi.spyOn(console, 'error').mockImplementation(() => {});
    await ask();
    await ended;
    expect(envelopes.at(-1)?.event).toEqual({ type: 'runEnded', stopReason: 'appFault' });
    expect(report).toHaveBeenCalledOnce();
    report.mockRestore();
  });
});
