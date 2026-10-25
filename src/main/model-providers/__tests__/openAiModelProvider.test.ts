import { describe, expect, it } from 'vitest';
import type { ModelStreamEvent } from '@shared/types/modelReply';
import type { ModelRequest } from '../modelProvider';
import { createOpenAiModelProvider, type OpenAiFetch } from '../openAiModelProvider';

const API_KEY = 'sk-test-0000';

const TOOL = {
  name: 'read_document',
  description: 'Read the open resume.',
  inputSchema: { type: 'object', properties: {} },
};

const USAGE = {
  input_tokens: 2400,
  input_tokens_details: { cached_tokens: 2048, cache_write_tokens: 0 },
  output_tokens: 31,
  output_tokens_details: { reasoning_tokens: 12 },
  total_tokens: 2431,
};

const REASONING_ITEM = {
  id: 'rs_01',
  type: 'reasoning',
  summary: [],
  encrypted_content: 'gAAAAB-opaque',
};

const completed = { type: 'response.completed', response: { status: 'completed', usage: USAGE } };

function request(overrides: Partial<ModelRequest> = {}): ModelRequest {
  return {
    model: 'gpt-5.6-terra',
    system: 'You help with resumes.',
    messages: [{ role: 'user', text: 'Tighten my summary.' }],
    tools: [TOOL],
    cacheKey: 'mosaic-conversation-1',
    signal: new AbortController().signal,
    ...overrides,
  };
}

/** A streamed reply, as OpenAI sends it: server-sent events named by their type. */
type RecordedEvent = { type: string } & Record<string, unknown>;

function streamed(events: RecordedEvent[]): Response {
  const body = events
    .map((event, index) => {
      const data = JSON.stringify({ ...event, sequence_number: index });
      return `event: ${event.type}\ndata: ${data}\n\n`;
    })
    .join('');
  return new Response(body, { headers: { 'content-type': 'text/event-stream' } });
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

/** An OpenAI that answers with `reply`, remembering every request it was sent. */
function openAi(reply: () => Response | Promise<Response>) {
  const sent: SentRequest[] = [];
  const fetch: OpenAiFetch = async (url, init) => {
    sent.push({
      url: String(url),
      headers: new Headers(init?.headers),
      body: JSON.parse(String(init?.body)),
    });
    return reply();
  };
  let time = 0;
  const provider = createOpenAiModelProvider({ apiKey: API_KEY, fetch, now: () => (time += 400) });
  return { provider, sent };
}

async function collect(events: AsyncIterable<ModelStreamEvent>): Promise<ModelStreamEvent[]> {
  const collected: ModelStreamEvent[] = [];
  for await (const event of events) collected.push(event);
  return collected;
}

async function errorFrom(reply: () => Response | Promise<Response>) {
  const events = await collect(openAi(reply).provider.streamReply(request()));
  expect(events).toHaveLength(1);
  return events[0].type === 'error' ? events[0].error : undefined;
}

describe('createOpenAiModelProvider', () => {
  it('streams text and finishes with the tokens, cached ones included', async () => {
    const { provider } = openAi(() =>
      streamed([
        { type: 'response.created' },
        { type: 'response.output_text.delta', delta: 'Led a team ' },
        { type: 'response.output_text.delta', delta: 'of five.' },
        completed,
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

  it('sends the whole conversation, kept nowhere, with the key only in its header', async () => {
    const { provider, sent } = openAi(() => streamed([completed]));
    await collect(
      provider.streamReply(
        request({
          messages: [
            { role: 'user', text: 'Tighten my summary.' },
            {
              role: 'assistant',
              parts: [
                { type: 'reasoning', durationMs: 900, providerState: REASONING_ITEM },
                // Another provider's reasoning, from before the conversation switched.
                { type: 'reasoning', text: 'Hmm.', durationMs: 300 },
                { type: 'text', text: 'Reading it.' },
                { type: 'toolCall', callId: 'call_1', name: 'read_document', args: {} },
                { type: 'toolCall', callId: 'call_2', name: 'propose_rewrite', args: '{"id":' },
              ],
            },
            { role: 'toolResult', callId: 'call_1', toolName: 'read_document', content: 'Ada' },
          ],
        })
      )
    );

    const [{ url, headers, body }] = sent;
    expect(url).toBe('https://api.openai.com/v1/responses');
    expect(headers.get('authorization')).toBe(`Bearer ${API_KEY}`);
    expect(url + JSON.stringify(body)).not.toContain(API_KEY);
    expect(body).toEqual({
      model: 'gpt-5.6-terra',
      instructions: 'You help with resumes.',
      input: [
        { role: 'user', content: 'Tighten my summary.' },
        REASONING_ITEM,
        { role: 'assistant', content: 'Reading it.' },
        { type: 'function_call', call_id: 'call_1', name: 'read_document', arguments: '{}' },
        { type: 'function_call', call_id: 'call_2', name: 'propose_rewrite', arguments: '{"id":' },
        { type: 'function_call_output', call_id: 'call_1', output: 'Ada' },
      ],
      tools: [
        {
          type: 'function',
          name: 'read_document',
          description: 'Read the open resume.',
          parameters: { type: 'object', properties: {} },
          strict: false,
        },
      ],
      stream: true,
      store: false,
      include: ['reasoning.encrypted_content'],
      prompt_cache_key: 'mosaic-conversation-1',
    });
  });

  it('passes on parallel calls whole, and keeps reasoning to send back unchanged', async () => {
    const call = (id: string, name: string, args: string) => ({
      type: 'response.output_item.done',
      item: { type: 'function_call', id: `fc_${id}`, call_id: id, name, arguments: args },
    });
    const { provider } = openAi(() =>
      streamed([
        {
          type: 'response.output_item.added',
          item: { ...REASONING_ITEM, encrypted_content: null },
        },
        { type: 'response.output_item.done', item: REASONING_ITEM },
        { type: 'response.function_call_arguments.delta', item_id: 'fc_call_1', delta: '{"id"' },
        call('call_1', 'propose_rewrite', '{"id":"b1","text":"Led five."}'),
        call('call_2', 'propose_rewrite', '{"id": "b2", "text": '),
        completed,
      ])
    );
    expect((await collect(provider.streamReply(request()))).slice(0, 4)).toEqual([
      { type: 'reasoningStart' },
      { type: 'reasoningEnd', durationMs: 400, providerState: REASONING_ITEM },
      {
        type: 'toolCall',
        callId: 'call_1',
        name: 'propose_rewrite',
        args: { id: 'b1', text: 'Led five.' },
      },
      // Won't parse: goes on as written, for the repair round.
      {
        type: 'toolCall',
        callId: 'call_2',
        name: 'propose_rewrite',
        args: '{"id": "b2", "text": ',
      },
    ]);
  });

  it('ends at the output limit, and as blocked when the filter stopped it', async () => {
    const incomplete = (reason: string) =>
      streamed([
        {
          type: 'response.incomplete',
          response: { status: 'incomplete', incomplete_details: { reason }, usage: USAGE },
        },
      ]);
    expect(
      await collect(openAi(() => incomplete('max_output_tokens')).provider.streamReply(request()))
    ).toEqual([
      {
        type: 'finish',
        reason: 'outputLimit',
        usage: { inputTokens: 2400, outputTokens: 31, cachedInputTokens: 2048 },
      },
    ]);
    expect(await errorFrom(() => incomplete('content_filter'))).toEqual({
      reason: 'contentBlocked',
    });
  });

  it.each([
    [
      'a refused key',
      failedWith(401, {
        message: 'Incorrect API key provided: sk-tes****0000.',
        code: 'invalid_api_key',
      }),
      {
        reason: 'keyRefused',
        message: 'Incorrect API key provided: sk-tes****0000.',
        httpStatus: 401,
      },
    ],
    [
      'an empty quota',
      failedWith(429, { message: 'You exceeded your current quota.', code: 'insufficient_quota' }),
      { reason: 'quotaExceeded', message: 'You exceeded your current quota.', httpStatus: 429 },
    ],
    [
      'a rate limit, with its wait',
      failedWith(
        429,
        { message: 'Rate limit reached.', code: 'rate_limit_exceeded' },
        { 'retry-after': '3' }
      ),
      {
        reason: 'rateLimited',
        retryAfterMs: 3000,
        message: 'Rate limit reached.',
        httpStatus: 429,
      },
    ],
    [
      'a missing model',
      failedWith(404, { message: 'The model `gpt-9` does not exist.', code: 'model_not_found' }),
      { reason: 'model-not-found', message: 'The model `gpt-9` does not exist.', httpStatus: 404 },
    ],
    [
      'a conversation too long',
      failedWith(400, {
        message: 'Your input exceeds the context window.',
        code: 'context_length_exceeded',
      }),
      {
        reason: 'context-too-long',
        message: 'Your input exceeds the context window.',
        httpStatus: 400,
      },
    ],
    [
      'any other refusal',
      failedWith(400, {
        message: 'Invalid schema for function.',
        code: 'invalid_function_parameters',
      }),
      { reason: 'failed', message: 'Invalid schema for function.', httpStatus: 400 },
    ],
    [
      'a server error',
      failedWith(500, { message: 'The server had an error.', code: null }),
      { reason: 'failed', message: 'The server had an error.', httpStatus: 500 },
    ],
    [
      'an error midway',
      streamed([
        { type: 'error', code: 'rate_limit_exceeded', message: 'Slow down.', param: null },
      ]),
      { reason: 'rateLimited', message: 'Slow down.' },
    ],
    [
      'a reply that failed',
      streamed([
        {
          type: 'response.failed',
          response: { status: 'failed', error: { code: 'server_error', message: 'Try again.' } },
        },
      ]),
      { reason: 'failed', message: 'Try again.' },
    ],
    [
      'a reply cut short',
      streamed([{ type: 'response.output_text.delta', delta: 'Led' }]),
      { reason: 'failed', message: 'OpenAI stopped before the reply was finished' },
    ],
  ])('sorts %s, keeping OpenAI’s words', async (_name, response, expected) => {
    const { provider } = openAi(() => response);
    const events = await collect(provider.streamReply(request()));
    expect(events.at(-1)).toEqual({ type: 'error', error: expected });
  });

  it('says what the network said when nothing answered', async () => {
    const refused = new TypeError('fetch failed', {
      cause: new Error('getaddrinfo ENOTFOUND api.openai.com'),
    });
    expect(
      await errorFrom(() => {
        throw refused;
      })
    ).toEqual({ reason: 'unreachable', message: 'getaddrinfo ENOTFOUND api.openai.com' });
  });

  it('ends quietly when stopped', async () => {
    const stop = new AbortController();
    const { provider } = openAi(() => {
      stop.abort();
      throw new DOMException('This operation was aborted', 'AbortError');
    });
    expect(await collect(provider.streamReply(request({ signal: stop.signal })))).toEqual([]);
  });
});
