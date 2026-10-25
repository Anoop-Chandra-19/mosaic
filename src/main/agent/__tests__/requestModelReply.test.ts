import { describe, expect, it } from 'vitest';
import type { AgentRunEvent } from '@shared/types/agentRunEvents';
import type { ModelProviderError, ModelStreamEvent } from '@shared/types/modelReply';
import { requestModelReply, type ReplyRequest } from '../requestModelReply';
import { RUN_LIMITS } from '../runLimits';
import { callTool, DONE, hang, say, scriptedModel, type ScriptedReply } from './scriptedRun';

const failWith = (error: ModelProviderError): ModelStreamEvent[] => [{ type: 'error', error }];

function request(replies: ScriptedReply[], overrides: Partial<ReplyRequest> = {}) {
  const model = scriptedModel(replies);
  const events: AgentRunEvent[] = [];
  const waits: number[] = [];
  const options: ReplyRequest = {
    provider: model.provider,
    request: { model: 'qwen3.5:9b', system: '', messages: [], tools: [], cacheKey: 'c1' },
    signal: new AbortController().signal,
    onEvent: (event) => events.push(event),
    limits: RUN_LIMITS,
    wait: async (ms) => {
      waits.push(ms);
    },
    ...overrides,
  };
  return { reply: requestModelReply(options), model, events, waits };
}

describe('requestModelReply', () => {
  it('collects the stream into parts, joining text that arrived in pieces', async () => {
    const { reply, events } = request([
      [say('Tight'), say('ened.'), callTool('c1', 'read_document'), DONE],
    ]);
    expect(await reply).toEqual({
      ok: true,
      parts: [
        { type: 'text', text: 'Tightened.' },
        { type: 'toolCall', callId: 'c1', name: 'read_document', args: {} },
      ],
      finish: 'complete',
      usage: { inputTokens: 100, outputTokens: 10 },
    });
    expect(events).toEqual([
      { type: 'textDelta', text: 'Tight' },
      { type: 'textDelta', text: 'ened.' },
      { type: 'toolCall', callId: 'c1', name: 'read_document' },
    ]);
  });

  it('retries a lost connection, a server error and a stalled reply after 1, 4 and 16 seconds, then gives up', async () => {
    const lost = failWith({ reason: 'unreachable' });
    const serverError = failWith({ reason: 'failed', message: 'Bad gateway', httpStatus: 502 });
    const { reply, waits, model } = request([lost, serverError, hang, lost], {
      limits: { ...RUN_LIMITS, stallMs: 20 },
    });
    expect(await reply).toEqual({
      ok: false,
      reason: 'connection',
      error: { reason: 'unreachable' },
      attempts: 4,
      waitedMs: 21_000,
    });
    expect(waits).toEqual([1000, 4000, 16_000]);
    expect(model.requests).toHaveLength(4);
  });

  it('waits as long as a rate limit asks, and succeeds on the retry', async () => {
    const { reply, waits, events } = request([
      failWith({ reason: 'rateLimited', retryAfterMs: 7000 }),
      [say('Done.'), DONE],
    ]);
    expect(await reply).toMatchObject({ ok: true });
    expect(waits).toEqual([7000]);
    expect(events[0]).toEqual({
      type: 'stepRetrying',
      attempt: 1,
      waitMs: 7000,
      error: { reason: 'rateLimited', retryAfterMs: 7000 },
    });
  });

  it.each<[string, ModelProviderError]>([
    ['a refused key', { reason: 'keyRefused', message: 'invalid x-api-key', httpStatus: 401 }],
    ['a refused request', { reason: 'failed', message: 'Invalid argument', httpStatus: 400 }],
    [
      'an empty quota',
      { reason: 'quotaExceeded', message: 'Insufficient credits', httpStatus: 402 },
    ],
    ['a missing model', { reason: 'model-not-found' }],
    ['a model without tools', { reason: 'toolsUnsupported', message: 'does not support tools' }],
    ['blocked content', { reason: 'contentBlocked', message: 'Flagged' }],
    ['a long context', { reason: 'context-too-long' }],
  ])('stops at once on %s, keeping the provider’s error', async (_, error) => {
    const { reply, waits } = request([failWith(error)]);
    expect(await reply).toEqual({
      ok: false,
      reason: 'providerError',
      error,
      attempts: 1,
      waitedMs: 0,
    });
    expect(waits).toEqual([]);
  });
});
