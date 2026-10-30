import { describe, expect, it } from 'vitest';
import type { ModelStreamEvent } from '@shared/types/modelReply';
import { createAnthropicModelProvider, type AnthropicFetch } from '../anthropicModelProvider';
import type { ModelRequest } from '../../modelProvider';

const API_KEY = 'sk-ant-test-0000';

const TOOL = {
  name: 'read_document',
  description: 'Read the open resume.',
  inputSchema: { type: 'object', properties: {} },
};

const START_USAGE = {
  input_tokens: 40,
  cache_read_input_tokens: 2048,
  cache_creation_input_tokens: 312,
  output_tokens: 1,
};

const THINKING_BLOCK = { type: 'thinking', thinking: 'Read first.', signature: 'EqQBCkYI-opaque' };
const REDACTED_BLOCK = { type: 'redacted_thinking', data: 'EmwKAhgB-opaque' };

const messageStart = {
  type: 'message_start',
  message: { id: 'msg_01', type: 'message', role: 'assistant', content: [], usage: START_USAGE },
};

function messageEnd(stopReason: string, outputTokens = 31): RecordedEvent[] {
  return [
    {
      type: 'message_delta',
      delta: { stop_reason: stopReason, stop_sequence: null },
      usage: { output_tokens: outputTokens },
    },
    { type: 'message_stop' },
  ];
}

/** The tokens `messageStart` and `messageEnd` add up to. */
const USAGE = { inputTokens: 2400, outputTokens: 31, cachedInputTokens: 2048 };

function textBlock(index: number, ...pieces: string[]): RecordedEvent[] {
  return [
    { type: 'content_block_start', index, content_block: { type: 'text', text: '' } },
    ...pieces.map((text) => ({
      type: 'content_block_delta',
      index,
      delta: { type: 'text_delta', text },
    })),
    { type: 'content_block_stop', index },
  ];
}

function toolUseBlock(index: number, id: string, ...pieces: string[]): RecordedEvent[] {
  return [
    {
      type: 'content_block_start',
      index,
      content_block: { type: 'tool_use', id, name: 'propose_rewrite', input: {} },
    },
    ...pieces.map((partial_json) => ({
      type: 'content_block_delta',
      index,
      delta: { type: 'input_json_delta', partial_json },
    })),
    { type: 'content_block_stop', index },
  ];
}

function request(overrides: Partial<ModelRequest> = {}): ModelRequest {
  return {
    model: 'claude-sonnet-5-5',
    system: 'You help with resumes.',
    messages: [{ role: 'user', text: 'Tighten my summary.' }],
    tools: [TOOL],
    cacheKey: 'mosaic-conversation-1',
    signal: new AbortController().signal,
    ...overrides,
  };
}

/** A streamed reply, as Anthropic sends it: server-sent events named by their type. */
type RecordedEvent = { type: string } & Record<string, unknown>;

function streamed(events: RecordedEvent[]): Response {
  const body = events
    .map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
    .join('');
  return new Response(body, { headers: { 'content-type': 'text/event-stream' } });
}

function failedWith(
  status: number,
  type: string,
  message: string,
  headers: Record<string, string> = {}
) {
  return new Response(JSON.stringify({ type: 'error', error: { type, message } }), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

interface SentRequest {
  url: string;
  headers: Headers;
  body: Record<string, unknown>;
}

/** An Anthropic that answers with `reply`, remembering every request it was sent. */
function anthropic(reply: () => Response | Promise<Response>) {
  const sent: SentRequest[] = [];
  const fetch: AnthropicFetch = async (url, init) => {
    sent.push({
      url: String(url),
      headers: new Headers(init?.headers),
      body: JSON.parse(String(init?.body)),
    });
    return reply();
  };
  let time = 0;
  const provider = createAnthropicModelProvider({
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

describe('createAnthropicModelProvider', () => {
  it('streams text and finishes with all the input tokens, cached ones included', async () => {
    const { provider } = anthropic(() =>
      streamed([
        messageStart,
        ...textBlock(0, 'Led a team ', 'of five.'),
        ...messageEnd('end_turn'),
      ])
    );
    expect(await collect(provider.streamReply(request()))).toEqual([
      { type: 'textDelta', text: 'Led a team ' },
      { type: 'textDelta', text: 'of five.' },
      { type: 'finish', reason: 'complete', usage: USAGE },
    ]);
  });

  it('sends the conversation in alternating turns, cached, with the key only in its header', async () => {
    const { provider, sent } = anthropic(() => streamed([messageStart, ...messageEnd('end_turn')]));
    await collect(
      provider.streamReply(
        request({
          messages: [
            { role: 'user', text: 'Tighten my summary.' },
            {
              role: 'assistant',
              parts: [
                { type: 'reasoning', durationMs: 900, providerState: THINKING_BLOCK },
                // Another provider's reasoning, from before the conversation switched.
                { type: 'reasoning', text: 'Hmm.', durationMs: 300, providerState: { id: 'rs' } },
                { type: 'text', text: 'Reading it.' },
                { type: 'toolCall', callId: 'toolu_1', name: 'read_document', args: {} },
                { type: 'toolCall', callId: 'toolu_2', name: 'propose_rewrite', args: '{"id":' },
              ],
            },
            { role: 'toolResult', callId: 'toolu_1', toolName: 'read_document', content: 'Ada' },
            {
              role: 'toolResult',
              callId: 'toolu_2',
              toolName: 'propose_rewrite',
              content: 'The arguments aren’t JSON.',
              isError: true,
            },
            {
              role: 'assistant',
              parts: [{ type: 'reasoning', durationMs: 200, providerState: REDACTED_BLOCK }],
            },
            { role: 'user', text: 'Shorter, please.' },
          ],
        })
      )
    );

    const [{ url, headers, body }] = sent;
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(headers.get('authorization')).toBe(`Bearer ${API_KEY}`);
    expect(url + JSON.stringify(body)).not.toContain(API_KEY);
    expect(body).toEqual({
      model: 'claude-sonnet-5-5',
      max_tokens: 32_000,
      system: 'You help with resumes.',
      messages: [
        { role: 'user', content: [{ type: 'text', text: 'Tighten my summary.' }] },
        {
          role: 'assistant',
          content: [
            THINKING_BLOCK,
            { type: 'text', text: 'Reading it.' },
            { type: 'tool_use', id: 'toolu_1', name: 'read_document', input: {} },
            { type: 'tool_use', id: 'toolu_2', name: 'propose_rewrite', input: {} },
          ],
        },
        {
          role: 'user',
          content: [
            { type: 'tool_result', tool_use_id: 'toolu_1', content: 'Ada' },
            {
              type: 'tool_result',
              tool_use_id: 'toolu_2',
              content: 'The arguments aren’t JSON.',
              is_error: true,
            },
          ],
        },
        { role: 'assistant', content: [REDACTED_BLOCK] },
        { role: 'user', content: [{ type: 'text', text: 'Shorter, please.' }] },
      ],
      tools: [
        {
          name: 'read_document',
          description: 'Read the open resume.',
          input_schema: { type: 'object', properties: {} },
        },
      ],
      stream: true,
      cache_control: { type: 'ephemeral' },
    });
  });

  it('passes on thinking whole to send back, and calls in order once their arguments are in', async () => {
    const { provider } = anthropic(() =>
      streamed([
        messageStart,
        {
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'thinking', thinking: '', signature: '' },
        },
        {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'thinking_delta', thinking: 'Read ' },
        },
        {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'thinking_delta', thinking: 'first.' },
        },
        {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'signature_delta', signature: THINKING_BLOCK.signature },
        },
        { type: 'content_block_stop', index: 0 },
        { type: 'content_block_start', index: 1, content_block: REDACTED_BLOCK },
        { type: 'content_block_stop', index: 1 },
        ...toolUseBlock(2, 'toolu_1', '{"id":"b1",', '"text":"Led five."}'),
        ...toolUseBlock(3, 'toolu_2'),
        ...toolUseBlock(4, 'toolu_3', '{"id": "b2", "text": '),
        ...messageEnd('tool_use'),
      ])
    );
    expect(await collect(provider.streamReply(request()))).toEqual([
      { type: 'reasoningStart' },
      {
        type: 'reasoningEnd',
        text: 'Read first.',
        durationMs: 400,
        providerState: THINKING_BLOCK,
      },
      { type: 'reasoningStart' },
      { type: 'reasoningEnd', durationMs: 400, providerState: REDACTED_BLOCK },
      {
        type: 'toolCall',
        callId: 'toolu_1',
        name: 'propose_rewrite',
        args: { id: 'b1', text: 'Led five.' },
      },
      { type: 'toolCall', callId: 'toolu_2', name: 'propose_rewrite', args: {} },
      // Won't parse: goes on as written, for the repair round.
      {
        type: 'toolCall',
        callId: 'toolu_3',
        name: 'propose_rewrite',
        args: '{"id": "b2", "text": ',
      },
      { type: 'finish', reason: 'complete', usage: USAGE },
    ]);
  });

  it.each([
    ['max_tokens', { type: 'finish', reason: 'outputLimit', usage: USAGE }],
    ['refusal', { type: 'error', error: { reason: 'contentBlocked' } }],
    ['model_context_window_exceeded', { type: 'error', error: { reason: 'context-too-long' } }],
  ])('ends a reply stopped by %s', async (stopReason, expected) => {
    const { provider } = anthropic(() => streamed([messageStart, ...messageEnd(stopReason)]));
    expect((await collect(provider.streamReply(request()))).at(-1)).toEqual(expected);
  });

  it.each([
    [
      'a refused key',
      failedWith(401, 'authentication_error', 'invalid x-api-key'),
      { reason: 'keyRefused', message: 'invalid x-api-key', httpStatus: 401 },
    ],
    [
      'a key without permission',
      failedWith(403, 'permission_error', 'Your API key does not have permission.'),
      { reason: 'keyRefused', message: 'Your API key does not have permission.', httpStatus: 403 },
    ],
    [
      'an unpaid bill',
      failedWith(402, 'billing_error', 'Your organization has an unpaid balance.'),
      {
        reason: 'quotaExceeded',
        message: 'Your organization has an unpaid balance.',
        httpStatus: 402,
      },
    ],
    [
      'no credit left',
      failedWith(400, 'invalid_request_error', 'Your credit balance is too low.'),
      { reason: 'quotaExceeded', message: 'Your credit balance is too low.', httpStatus: 400 },
    ],
    [
      'a rate limit, with its wait',
      failedWith(429, 'rate_limit_error', 'Number of requests has exceeded your limit.', {
        'retry-after': '3',
      }),
      {
        reason: 'rateLimited',
        retryAfterMs: 3000,
        message: 'Number of requests has exceeded your limit.',
        httpStatus: 429,
      },
    ],
    [
      'a missing model',
      failedWith(404, 'not_found_error', 'model: claude-9'),
      { reason: 'model-not-found', message: 'model: claude-9', httpStatus: 404 },
    ],
    [
      'a conversation too long',
      failedWith(400, 'invalid_request_error', 'prompt is too long: 210000 tokens > 200000'),
      {
        reason: 'context-too-long',
        message: 'prompt is too long: 210000 tokens > 200000',
        httpStatus: 400,
      },
    ],
    [
      'any other refusal',
      failedWith(400, 'invalid_request_error', 'tools.0.name: String should match pattern'),
      { reason: 'failed', message: 'tools.0.name: String should match pattern', httpStatus: 400 },
    ],
    [
      'an overloaded Anthropic',
      failedWith(529, 'overloaded_error', 'Overloaded'),
      { reason: 'failed', message: 'Overloaded', httpStatus: 529 },
    ],
    [
      'an error midway',
      streamed([
        messageStart,
        { type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } },
      ]),
      { reason: 'failed', message: 'Overloaded' },
    ],
    [
      'a reply cut short',
      streamed([messageStart, ...textBlock(0, 'Led')]),
      { reason: 'failed', message: 'Anthropic stopped before the reply was finished' },
    ],
  ])('sorts %s, keeping Anthropic’s words', async (_name, response, expected) => {
    const { provider } = anthropic(() => response);
    const events = await collect(provider.streamReply(request()));
    expect(events.at(-1)).toEqual({ type: 'error', error: expected });
  });

  it('says what the network said when nothing answered', async () => {
    const refused = new TypeError('fetch failed', {
      cause: new Error('getaddrinfo ENOTFOUND api.anthropic.com'),
    });
    const { provider } = anthropic(() => {
      throw refused;
    });
    expect(await collect(provider.streamReply(request()))).toEqual([
      {
        type: 'error',
        error: { reason: 'unreachable', message: 'getaddrinfo ENOTFOUND api.anthropic.com' },
      },
    ]);
  });

  it('ends quietly when stopped', async () => {
    const stop = new AbortController();
    const { provider } = anthropic(() => {
      stop.abort();
      throw new DOMException('This operation was aborted', 'AbortError');
    });
    expect(await collect(provider.streamReply(request({ signal: stop.signal })))).toEqual([]);
  });
});
