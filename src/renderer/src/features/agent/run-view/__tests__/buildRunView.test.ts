import { describe, expect, it } from 'vitest';
import type { TranscriptMessage, TranscriptMessageBody } from '@shared/types/agentConversation';
import { buildRunView } from '../buildRunView';

const messages = (rows: [number | null, TranscriptMessageBody][]): TranscriptMessage[] =>
  rows.map(([runId, body], i) => ({
    id: i + 1,
    seq: i + 1,
    runId,
    runModel: runId === null ? null : { provider: 'ollama', model: 'qwen3.5:9b' },
    body,
    createdAt: (i + 1) * 1000,
  }));

describe('buildRunView', () => {
  it('keeps the view of a run as older messages arrive, and builds one that grew afresh', () => {
    const ask = (text: string): TranscriptMessageBody => ({
      type: 'user',
      text,
      resume: [],
      isLimit: false,
    });
    const stored = messages([
      [1, ask('First.')],
      [2, ask('Second.')],
      [3, ask('Third.')],
    ]);
    const shown = buildRunView(stored.slice(1));
    const withOlder = buildRunView(stored);
    expect(withOlder[1]).toBe(shown[0]);
    expect(withOlder[2]).toBe(shown[1]);

    const [grown] = messages([[3, { type: 'assistant', content: [] }]]);
    expect(buildRunView([...stored, grown])[2]).not.toBe(shown[1]);
  });

  it('folds each run’s stored messages into one view, in order', () => {
    const stop = {
      type: 'runStopped',
      reason: 'connection',
      providerError: { reason: 'unreachable', message: 'getaddrinfo ENOTFOUND' },
      attempts: 4,
      waitedMs: 21_000,
    } as const;

    const runs = buildRunView(
      messages([
        [1, { type: 'user', text: 'Tighten my bullets.', resume: [], isLimit: false }],
        [
          1,
          {
            type: 'assistant',
            content: [
              { type: 'reasoning', durationMs: 3400 },
              { type: 'text', text: 'Reading it first.' },
              { type: 'toolCall', callId: 'c1', name: 'read_document', args: {} },
              { type: 'toolCall', callId: 'c2', name: 'propose_rewrite', args: { handle: 'b1' } },
            ],
            finish: 'complete',
          },
        ],
        [1, { type: 'toolResults', results: [{ callId: 'c1' }, { callId: 'c2', isError: true }] }],
        [1, { type: 'assistant', content: [{ type: 'text', text: 'Done.' }], finish: 'complete' }],
        [null, { type: 'user', text: 'Written outside a run.', resume: [], isLimit: false }],
        [
          2,
          { type: 'templateSwitched', templateId: 't2', label: 'Data, startups', previousId: 't1' },
        ],
        [2, { type: 'assistant', content: [{ type: 'text', text: 'Cut' }] }],
        [2, stop],
      ])
    );

    expect(runs).toEqual([
      {
        runId: 1,
        model: { provider: 'ollama', model: 'qwen3.5:9b' },
        startedAt: 1000,
        lastAt: 4000,
        ask: 'Tighten my bullets.',
        switchedTo: null,
        parts: [
          { type: 'reasoning', durationMs: 3400 },
          { type: 'text', text: 'Reading it first.' },
          {
            type: 'toolCall',
            callId: 'c1',
            name: 'read_document',
            args: {},
            status: 'done',
            request: { retries: [], callCount: 2 },
            resultMessageId: 3,
          },
          {
            type: 'toolCall',
            callId: 'c2',
            name: 'propose_rewrite',
            args: { handle: 'b1' },
            status: 'refused',
            request: { retries: [], callCount: 2 },
            resultMessageId: 3,
          },
          { type: 'text', text: 'Done.' },
        ],
        stop: null,
        stoppedAt: null,
      },
      {
        runId: 2,
        model: { provider: 'ollama', model: 'qwen3.5:9b' },
        startedAt: 6000,
        lastAt: 8000,
        ask: null,
        switchedTo: { templateId: 't2', label: 'Data, startups' },
        parts: [{ type: 'text', text: 'Cut' }],
        stop,
        stoppedAt: 8000,
      },
    ]);
  });

  it('keeps what each call was about, and tells a call never run from a refused one', () => {
    const target = { kind: 'version', version: 'v3' } as const;
    const [run] = buildRunView(
      messages([
        [
          3,
          {
            type: 'assistant',
            content: [
              { type: 'toolCall', callId: 'c1', name: 'read_newest_version', args: {} },
              { type: 'toolCall', callId: 'c2', name: 'read_document', args: {} },
            ],
          },
        ],
        [
          3,
          {
            type: 'toolResults',
            results: [
              { callId: 'c1', target, durationMs: 1200 },
              { callId: 'c2', isError: true, notRun: true },
            ],
          },
        ],
      ])
    );
    expect(run.parts).toMatchObject([
      { callId: 'c1', status: 'done', target, durationMs: 1200 },
      { callId: 'c2', status: 'notRun' },
    ]);
  });

  it('leaves a call that never got its result running', () => {
    const [run] = buildRunView(
      messages([
        [
          3,
          {
            type: 'assistant',
            content: [{ type: 'toolCall', callId: 'c1', name: 'read_document', args: {} }],
          },
        ],
        [3, { type: 'runStopped', reason: 'cancelled' }],
      ])
    );
    expect(run.parts).toEqual([
      {
        type: 'toolCall',
        callId: 'c1',
        name: 'read_document',
        args: {},
        status: 'running',
        request: { retries: [], callCount: 1 },
      },
    ]);
  });

  it('gives each call its request’s facts, and adds up what the run used', () => {
    const retries = [{ error: { reason: 'unreachable' }, waitMs: 1000 }] as const;
    const first = {
      id: 1,
      seq: 1,
      runId: 4,
      runNumber: 7,
      runModel: null,
      usage: { inputTokens: 100, cachedInputTokens: 60, outputTokens: 10 },
      body: {
        type: 'assistant',
        content: [{ type: 'toolCall', callId: 'c1', name: 'read_document', args: {} }],
        retries: [...retries],
      },
      createdAt: 0,
    } satisfies TranscriptMessage;
    const second = {
      ...first,
      id: 2,
      seq: 2,
      usage: { inputTokens: 200, outputTokens: 20 },
      body: { type: 'assistant', content: [{ type: 'text', text: 'Done.' }] },
    } satisfies TranscriptMessage;

    const [run] = buildRunView([first, second]);
    expect(run.number).toBe(7);
    expect(run.usage).toEqual({ inputTokens: 300, cachedInputTokens: 60, outputTokens: 30 });
    expect(run.parts[0]).toMatchObject({
      request: { usage: first.usage, retries, callCount: 1 },
    });
  });
});
