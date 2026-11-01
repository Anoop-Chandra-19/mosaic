import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentRunEvent } from '@shared/types/agentRunEvents';
import { turnOnDevLog } from '../devLog';
import {
  formatDevLogForReading,
  formatDevLogJson,
  formatDuration,
  type DevLogEntry,
} from '../formatDevLog';
import { readRefusal, withBridgeLog } from '../logBridgeCalls';
import { logRunEnvelope, logRunStarted, logStepAsked, logStepFinished } from '../logRunEvents';

/** What was logged, each line read back as the JSON it must be. */
const logged = () =>
  vi.mocked(console.log).mock.calls.map(([line]) => JSON.parse(String(line)) as object);

beforeAll(turnOnDevLog);

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

describe('a line of the log', () => {
  const at = new Date(2026, 9, 30, 14, 2, 31, 4);
  const entry = (
    context: string,
    message: string,
    fields: DevLogEntry['fields'] = {},
    level: DevLogEntry['level'] = 'info'
  ): DevLogEntry => ({ at, level, context, message, fields });
  /** The readable line, without its colours. */
  const read = (line: DevLogEntry) =>
    // eslint-disable-next-line no-control-regex
    formatDevLogForReading(line).replace(/\u001b\[\d+m/g, '');

  const RUN = { conversation: 12, run: 1, runId: 17, provider: 'ollama', model: 'qwen3.5:9b' };

  it('is one JSON object when piped, and leaves out fields with no value', () => {
    expect(
      JSON.parse(
        formatDevLogJson(
          entry('bridge', 'call refused', { channel: 'db:boot', step: undefined }, 'warn')
        )
      )
    ).toEqual({
      time: at.toISOString(),
      level: 'warn',
      context: 'bridge',
      message: 'call refused',
      channel: 'db:boot',
    });
  });

  it('gives short times in ms and long ones in seconds', () => {
    expect([12.4, 999, 3400].map(formatDuration)).toEqual(['12ms', '999ms', '3.4s']);
  });

  it.each<[string, DevLogEntry, string]>([
    [
      'a run’s start, naming it',
      entry('run', 'run started', RUN),
      '14:02:31.004  run      run started  conversation=12 run=1 runId=17 provider=ollama model=qwen3.5:9b',
    ],
    [
      'a line within a run, with only what is new',
      entry('run', 'tool finished', {
        ...RUN,
        step: 1,
        tool: 'read_document',
        callId: 'call_6y',
        durationMs: 7,
        outcome: 'ok',
      }),
      '14:02:31.004  run        tool finished 7ms  step=1 tool=read_document',
    ],
    [
      'a refused tool, which says so',
      entry('run', 'tool finished', { ...RUN, step: 1, outcome: 'refused' }, 'warn'),
      '14:02:31.004  run        tool finished  step=1 outcome=refused',
    ],
    [
      'a bridge call, by its channel',
      entry('bridge', 'call answered', { channel: 'db:boot', durationMs: 1, outcome: 'ok' }),
      '14:02:31.004  bridge   db:boot 1ms',
    ],
    [
      'a refused bridge call',
      entry(
        'bridge',
        'call refused',
        { channel: 'agent:start', durationMs: 2, outcome: 'refused', reason: 'noApiKey' },
        'warn'
      ),
      '14:02:31.004  bridge   agent:start call refused 2ms  outcome=refused reason=noApiKey',
    ],
    [
      'a long warning, by its first line',
      entry('page', 'Electron Security Warning\nThis renderer…', {}, 'warn'),
      '14:02:31.004  page     Electron Security Warning',
    ],
    [
      'an error, whole',
      entry('page', 'Uncaught Error: no\n  at here', {}, 'error'),
      '14:02:31.004  page     Uncaught Error: no\n  at here',
    ],
  ])('to read: %s', (_, line, expected) => {
    expect(read(line)).toBe(expected);
  });
});

describe('a bridge call', () => {
  it.each<[string, unknown, string | null]>([
    ['a plain answer', { rev: 3 }, null],
    ['a list', [], null],
    ['a success', { ok: true }, null],
    ['a database refusal', { ok: false, code: 'stale-rev' }, 'stale-rev'],
    ['a start refusal', { ok: false, reason: 'noApiKey' }, 'noApiKey'],
    ['a refusal with no reason', { ok: false }, 'no reason given'],
  ])('reads %s', (_, answer, refusal) => {
    expect(readRefusal(answer)).toBe(refusal);
  });

  it('answers as it would have, and logs only its channel, time and outcome', async () => {
    const key = 'sk-never-in-the-log';
    const answer = vi.fn(async (_provider: string, given: string) => ({ saved: given }));
    await expect(withBridgeLog('secrets:save', answer)('openai', key)).resolves.toEqual({
      saved: key,
    });
    expect(answer).toHaveBeenCalledWith('openai', key);
    expect(logged()).toEqual([
      {
        time: expect.any(String),
        level: 'info',
        context: 'bridge',
        message: 'call answered',
        channel: 'secrets:save',
        durationMs: expect.any(Number),
        outcome: 'ok',
      },
    ]);
  });

  it('says a refusal as a warning', async () => {
    await withBridgeLog('agent:start', () => ({ ok: false, reason: 'noApiKey' }))();
    expect(logged()[0]).toMatchObject({ level: 'warn', outcome: 'refused', reason: 'noApiKey' });
  });

  it('says a failure as an error, and lets it reach the page all the same', async () => {
    const failing = withBridgeLog('db:boot', () => {
      throw new Error('The database is closed');
    });
    await expect(failing()).rejects.toThrow('The database is closed');
    expect(logged()[0]).toMatchObject({
      level: 'error',
      outcome: 'failed',
      error: 'The database is closed',
    });
  });
});

describe('a run', () => {
  const RUN = { conversation: 7, run: 3, runId: 16, provider: 'ollama', model: 'qwen3.5:9b' };

  const follow = (events: AgentRunEvent[]) =>
    events.forEach((event, index) =>
      logRunEnvelope({ conversationId: 7, runId: 16, seq: index + 1, event })
    );

  it('reads step by step, each line naming its run, with no text, arguments or targets', () => {
    logRunStarted({
      runId: 16,
      conversationId: 7,
      runNumber: 3,
      provider: 'ollama',
      model: 'qwen3.5:9b',
    });
    logStepAsked(16, 1, 6);
    follow([
      { type: 'stepStarted', step: 1 },
      { type: 'reasoningStart' },
      { type: 'reasoningEnd', durationMs: 3400 },
      { type: 'textDelta', text: 'A private ' },
      { type: 'textDelta', text: 'sentence.' },
      { type: 'toolCall', callId: 'c1', name: 'propose_rewrite' },
      { type: 'toolCall', callId: 'c1', name: 'propose_rewrite', args: { text: 'A private ask' } },
      {
        type: 'toolResult',
        callId: 'c1',
        isError: true,
        durationMs: 1200,
        target: { kind: 'place', section: 'A private heading' },
      },
    ]);
    logStepFinished(
      16,
      { inputTokens: 1204, outputTokens: 80, cachedInputTokens: 1000 },
      'outputLimit'
    );
    logStepAsked(16, 2, 8);
    follow([
      {
        type: 'stepRetrying',
        attempt: 1,
        waitMs: 1000,
        error: { reason: 'failed', message: 'A private message', httpStatus: 500 },
      },
      { type: 'runEnded', stopReason: 'connection' },
    ]);

    const time = expect.any(String);
    const durationMs = expect.any(Number);
    const line = (level: string, message: string, fields: object) => ({
      time,
      level,
      context: 'run',
      message,
      ...RUN,
      ...fields,
    });
    expect(logged()).toEqual([
      line('info', 'run started', {}),
      line('info', 'asking the model', { step: 1, messages: 6 }),
      line('info', 'first reply', { step: 1, durationMs }),
      line('info', 'thought', { step: 1, durationMs: 3400 }),
      line('info', 'text written', { step: 1, chars: 19, durationMs }),
      line('info', 'tool started', { step: 1, tool: 'propose_rewrite', callId: 'c1' }),
      line('warn', 'tool finished', {
        step: 1,
        tool: 'propose_rewrite',
        callId: 'c1',
        durationMs: 1200,
        outcome: 'refused',
      }),
      line('warn', 'model answered', {
        step: 1,
        durationMs,
        tokensIn: 1204,
        tokensOut: 80,
        tokensCached: 1000,
        finish: 'outputLimit',
      }),
      line('info', 'asking the model', { step: 2, messages: 8 }),
      line('warn', 'retrying', {
        step: 2,
        attempt: 1,
        waitMs: 1000,
        reason: 'failed',
        httpStatus: 500,
      }),
      line('error', 'run ended', {
        step: 2,
        outcome: 'connection',
        durationMs,
        steps: 2,
        tools: 1,
        refusals: 1,
        tokensIn: 1204,
        tokensOut: 80,
      }),
    ]);
    expect(JSON.stringify(logged())).not.toMatch(/private/);
  });

  it('leaves tokens out when a provider gives no counts', () => {
    logRunStarted({ runId: 17, conversationId: 7, runNumber: 4, provider: 'a', model: 'b' });
    logStepAsked(17, 1, 1);
    logStepFinished(17, null, 'complete');
    expect(logged().at(-1)).not.toHaveProperty('tokensIn');
  });
});
