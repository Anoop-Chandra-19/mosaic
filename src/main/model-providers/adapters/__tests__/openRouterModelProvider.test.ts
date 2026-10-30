import { describe, expect, it } from 'vitest';
import type { ModelStreamEvent } from '@shared/types/modelReply';
import type { ModelRequest } from '../../modelProvider';
import type { OpenAiFetch } from '../openAiClient';
import { createOpenRouterModelProvider } from '../openRouterModelProvider';

const API_KEY = 'sk-or-test-0000';

const TOOL = {
  name: 'read_document',
  description: 'Read the open resume.',
  inputSchema: { type: 'object', properties: {} },
};

const USAGE = {
  prompt_tokens: 2400,
  completion_tokens: 31,
  total_tokens: 2431,
  prompt_tokens_details: { cached_tokens: 2048 },
};

/** Claude's thinking behind OpenRouter, signed, as the next request must send it back. */
const SIGNED_THINKING = {
  type: 'reasoning.text',
  text: 'The summary repeats the first bullet.',
  signature: 'EqQBCkgIBxABGAIi-opaque',
  format: 'anthropic-claude-v1',
  index: 0,
};

function request(overrides: Partial<ModelRequest> = {}): ModelRequest {
  return {
    model: 'anthropic/claude-sonnet-5.5',
    system: 'You help with resumes.',
    messages: [{ role: 'user', text: 'Tighten my summary.' }],
    tools: [TOOL],
    cacheKey: 'mosaic-conversation-1',
    signal: new AbortController().signal,
    ...overrides,
  };
}

type Delta = Record<string, unknown>;

/** A chunk with one choice, as Chat Completions streams it. */
const chunk = (delta: Delta, finishReason: string | null = null, extra: Delta = {}) => ({
  id: 'gen-1',
  object: 'chat.completion.chunk',
  created: 1,
  model: 'anthropic/claude-sonnet-5.5',
  choices: [{ index: 0, delta, finish_reason: finishReason }],
  ...extra,
});

/** Usage comes in the last chunk, with no choices. */
const usageChunk = { ...chunk({}), choices: [], usage: USAGE };

function streamed(chunks: object[], { isDone = true } = {}): Response {
  const lines = chunks.map((each) => `data: ${JSON.stringify(each)}\n\n`);
  if (isDone) lines.push('data: [DONE]\n\n');
  return new Response(lines.join(''), { headers: { 'content-type': 'text/event-stream' } });
}

function failedWith(status: number, error: object, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

interface SentRequest {
  url: string;
  headers: Headers;
  body: Record<string, unknown>;
}

/** An OpenRouter that answers with `reply`, remembering every request it was sent. */
function openRouter(reply: () => Response | Promise<Response>) {
  const sent: SentRequest[] = [];
  const fetch: OpenAiFetch = async (url, init) => {
    sent.push({
      url,
      headers: new Headers(init?.headers),
      body: JSON.parse(String(init?.body)),
    });
    return reply();
  };
  let time = 0;
  const provider = createOpenRouterModelProvider({
    apiKey: API_KEY,
    fetch,
    now: () => (time += 400),
  });
  return { provider, sent };
}

async function collect(events: AsyncIterable<ModelStreamEvent>): Promise<ModelStreamEvent[]> {
  const collected: ModelStreamEvent[] = [];
  for await (const event of events) collected.push(event);
  return collected;
}

describe('createOpenRouterModelProvider', () => {
  it('streams text and finishes with the tokens, cached ones included', async () => {
    const { provider } = openRouter(() =>
      streamed([
        chunk({ role: 'assistant', content: 'Led a team ' }),
        chunk({ content: 'of five.' }),
        chunk({}, 'stop'),
        usageChunk,
      ])
    );
    expect(await collect(provider.streamReply(request()))).toEqual([
      { type: 'textDelta', text: 'Led a team ' },
      { type: 'textDelta', text: 'of five.' },
      {
        type: 'finish',
        reason: 'complete',
        usage: { inputTokens: 2400, outputTokens: 31, cachedInputTokens: 2048 },
      },
    ]);
  });

  it('sends the whole conversation, cached and kept on one route, with the key only in its header', async () => {
    const { provider, sent } = openRouter(() => streamed([chunk({}, 'stop')]));
    await collect(
      provider.streamReply(
        request({
          messages: [
            { role: 'user', text: 'Tighten my summary.' },
            {
              role: 'assistant',
              parts: [
                {
                  type: 'reasoning',
                  durationMs: 900,
                  providerState: { type: 'openrouter', details: [SIGNED_THINKING] },
                },
                // OpenAI's own reasoning, from before the conversation switched.
                {
                  type: 'reasoning',
                  durationMs: 300,
                  providerState: { type: 'reasoning', encrypted_content: 'gAAAAB-opaque' },
                },
                { type: 'text', text: 'Reading it.' },
                { type: 'toolCall', callId: 'call_1', name: 'read_document', args: {} },
                { type: 'toolCall', callId: 'call_2', name: 'propose_rewrite', args: '{"id":' },
              ],
            },
            { role: 'toolResult', callId: 'call_1', toolName: 'read_document', content: 'Ada' },
            {
              role: 'assistant',
              parts: [{ type: 'toolCall', callId: 'call_3', name: 'read_document', args: {} }],
            },
          ],
        })
      )
    );

    const [{ url, headers, body }] = sent;
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(headers.get('authorization')).toBe(`Bearer ${API_KEY}`);
    expect(url + JSON.stringify(body)).not.toContain(API_KEY);
    expect(body).toEqual({
      model: 'anthropic/claude-sonnet-5.5',
      messages: [
        { role: 'system', content: 'You help with resumes.' },
        { role: 'user', content: 'Tighten my summary.' },
        {
          role: 'assistant',
          content: 'Reading it.',
          tool_calls: [
            {
              id: 'call_1',
              type: 'function',
              function: { name: 'read_document', arguments: '{}' },
            },
            {
              id: 'call_2',
              type: 'function',
              function: { name: 'propose_rewrite', arguments: '{"id":' },
            },
          ],
          reasoning_details: [SIGNED_THINKING],
        },
        { role: 'tool', tool_call_id: 'call_1', content: 'Ada' },
        {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: 'call_3',
              type: 'function',
              function: { name: 'read_document', arguments: '{}' },
            },
          ],
        },
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'read_document',
            description: 'Read the open resume.',
            parameters: { type: 'object', properties: {} },
          },
        },
      ],
      stream: true,
      cache_control: { type: 'ephemeral' },
      session_id: 'mosaic-conversation-1',
    });
  });

  it('merges reasoning pieces to send back, says a call began, and passes it on whole at the end', async () => {
    const piece = (detail: Delta) =>
      chunk({ reasoning: detail.text ?? null, reasoning_details: [detail] });
    const callPiece = (index: number, call: Delta) => chunk({ tool_calls: [{ index, ...call }] });
    const { provider } = openRouter(() =>
      streamed([
        piece({
          type: 'reasoning.text',
          text: 'The summary repeats ',
          format: 'anthropic-claude-v1',
          index: 0,
        }),
        piece({ type: 'reasoning.text', text: 'the first bullet.', index: 0 }),
        piece({ type: 'reasoning.text', signature: 'EqQBCkgIBxABGAIi-opaque', index: 0 }),
        callPiece(0, {
          id: 'call_1',
          type: 'function',
          function: { name: 'propose_rewrite', arguments: '' },
        }),
        callPiece(1, {
          id: 'call_2',
          type: 'function',
          function: { name: 'propose_rewrite', arguments: '{"id": "b2", ' },
        }),
        callPiece(0, { function: { arguments: '{"id":"b1",' } }),
        callPiece(0, { function: { arguments: '"text":"Led five."}' } }),
        chunk({}, 'tool_calls'),
        usageChunk,
      ])
    );
    expect(await collect(provider.streamReply(request()))).toEqual([
      { type: 'reasoningStart' },
      {
        type: 'reasoningEnd',
        text: 'The summary repeats the first bullet.',
        durationMs: 400,
        providerState: { type: 'openrouter', details: [SIGNED_THINKING] },
      },
      { type: 'toolCallStart', callId: 'call_1', name: 'propose_rewrite' },
      { type: 'toolCallStart', callId: 'call_2', name: 'propose_rewrite' },
      {
        type: 'toolCall',
        callId: 'call_1',
        name: 'propose_rewrite',
        args: { id: 'b1', text: 'Led five.' },
      },
      // Won't parse: goes on as written, for the repair round.
      { type: 'toolCall', callId: 'call_2', name: 'propose_rewrite', args: '{"id": "b2", ' },
      {
        type: 'finish',
        reason: 'complete',
        usage: { inputTokens: 2400, outputTokens: 31, cachedInputTokens: 2048 },
      },
    ]);
  });

  it('ends at the output limit, and as blocked when the filter stopped it', async () => {
    const endedBy = (reason: string) => () => streamed([chunk({ content: 'Led' }, reason)]);
    expect(
      (await collect(openRouter(endedBy('length')).provider.streamReply(request()))).at(-1)
    ).toEqual({ type: 'finish', reason: 'outputLimit', usage: null });
    expect(
      (await collect(openRouter(endedBy('content_filter')).provider.streamReply(request()))).at(-1)
    ).toEqual({ type: 'error', error: { reason: 'contentBlocked' } });
  });

  it.each([
    [
      'a refused key',
      failedWith(401, { code: 401, message: 'No auth credentials found' }),
      { reason: 'keyRefused', message: 'No auth credentials found', httpStatus: 401 },
    ],
    [
      'no credits',
      failedWith(402, { code: 402, message: 'Insufficient credits.' }),
      { reason: 'quotaExceeded', message: 'Insufficient credits.', httpStatus: 402 },
    ],
    [
      'a rate limit, with its wait',
      failedWith(429, { code: 429, message: 'Rate limit exceeded.' }, { 'retry-after': '3' }),
      {
        reason: 'rateLimited',
        retryAfterMs: 3000,
        message: 'Rate limit exceeded.',
        httpStatus: 429,
      },
    ],
    [
      'a missing model',
      failedWith(404, { code: 404, message: 'No endpoints found for openai/gpt-9.' }),
      {
        reason: 'model-not-found',
        message: 'No endpoints found for openai/gpt-9.',
        httpStatus: 404,
      },
    ],
    [
      'a model no route runs with tools',
      failedWith(404, { code: 404, message: 'No endpoints found that support tool use.' }),
      {
        reason: 'toolsUnsupported',
        message: 'No endpoints found that support tool use.',
        httpStatus: 404,
      },
    ],
    [
      'a moderation flag',
      failedWith(403, {
        code: 403,
        message: 'Input was flagged.',
        metadata: { reasons: ['harassment'], provider_name: 'OpenAI' },
      }),
      { reason: 'contentBlocked', message: 'Input was flagged.', httpStatus: 403 },
    ],
    [
      'a key without permission',
      failedWith(403, { code: 403, message: 'Key limit exceeded.' }),
      { reason: 'failed', message: 'Key limit exceeded.', httpStatus: 403 },
    ],
    [
      'the provider behind it failing, in its own words',
      failedWith(502, {
        code: 502,
        message: 'Provider returned error',
        metadata: { provider_name: 'Anthropic', raw: '{"type":"overloaded_error"}' },
      }),
      {
        reason: 'failed',
        message: 'Provider returned error\n{"type":"overloaded_error"}',
        httpStatus: 502,
      },
    ],
    [
      'an error midway',
      streamed([
        chunk({ content: 'Led' }),
        chunk({}, 'error', { error: { code: 429, message: 'Slow down.' } }),
      ]),
      { reason: 'rateLimited', message: 'Slow down.' },
    ],
    [
      'a reply cut short',
      streamed([chunk({ content: 'Led' })], { isDone: false }),
      { reason: 'failed', message: 'OpenRouter stopped before the reply was finished' },
    ],
  ])('sorts %s, keeping OpenRouter’s words', async (_name, response, expected) => {
    const { provider } = openRouter(() => response);
    const events = await collect(provider.streamReply(request()));
    expect(events.at(-1)).toEqual({ type: 'error', error: expected });
  });

  it('says what the network said when nothing answered', async () => {
    const refused = new TypeError('fetch failed', {
      cause: new Error('getaddrinfo ENOTFOUND openrouter.ai'),
    });
    const { provider } = openRouter(() => {
      throw refused;
    });
    expect(await collect(provider.streamReply(request()))).toEqual([
      {
        type: 'error',
        error: { reason: 'unreachable', message: 'getaddrinfo ENOTFOUND openrouter.ai' },
      },
    ]);
  });

  it('ends quietly when stopped', async () => {
    const stop = new AbortController();
    const { provider } = openRouter(() => {
      stop.abort();
      throw new DOMException('This operation was aborted', 'AbortError');
    });
    expect(await collect(provider.streamReply(request({ signal: stop.signal })))).toEqual([]);
  });
});
