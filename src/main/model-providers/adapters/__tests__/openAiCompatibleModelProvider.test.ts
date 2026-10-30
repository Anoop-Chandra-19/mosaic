import { describe, expect, it, vi } from 'vitest';
import type { ModelStreamEvent } from '@shared/types/modelReply';
import type { ModelRequest } from '../../modelProvider';
import { createOpenAiCompatibleModelProvider } from '../openAiCompatibleModelProvider';
import type { OpenAiFetch } from '../openAiClient';

const ADDRESS = 'http://127.0.0.1:8080';

const REQUEST: ModelRequest = {
  model: 'qwen3.5-9b',
  system: 'You help with resumes.',
  messages: [
    { role: 'user', text: 'Tighten my summary.' },
    {
      role: 'assistant',
      parts: [
        { type: 'reasoning', text: 'It repeats the first bullet.', durationMs: 900 },
        { type: 'text', text: 'Reading it.' },
      ],
    },
    { role: 'user', text: 'Go on.' },
  ],
  tools: [
    {
      name: 'read_document',
      description: 'Read the open resume.',
      inputSchema: { type: 'object', properties: {} },
    },
  ],
  cacheKey: 'mosaic-conversation-1',
  signal: new AbortController().signal,
};

const chunk = (delta: object, finishReason: string | null = null) => ({
  choices: [{ index: 0, delta, finish_reason: finishReason }],
});

function streamed(chunks: object[]): Response {
  const lines = chunks.map((each) => `data: ${JSON.stringify(each)}\n\n`);
  return new Response([...lines, 'data: [DONE]\n\n'].join(''), {
    headers: { 'content-type': 'text/event-stream' },
  });
}

async function replyFrom(fetch: OpenAiFetch): Promise<ModelStreamEvent[]> {
  let clock = 0;
  const provider = createOpenAiCompatibleModelProvider({
    address: ADDRESS,
    fetch,
    now: () => (clock += 500),
  });
  const events: ModelStreamEvent[] = [];
  for await (const event of provider.streamReply(REQUEST)) events.push(event);
  return events;
}

const failingWith = async (status: number, body: string) => {
  const [event] = await replyFrom(async () => new Response(body, { status }));
  return event.type === 'error' ? event.error : event;
};

describe('createOpenAiCompatibleModelProvider', () => {
  it('asks the address given, and shows reasoning without sending it back', async () => {
    const fetch = vi.fn<OpenAiFetch>(async () =>
      streamed([
        chunk({ reasoning_content: 'The summary ' }),
        chunk({ reasoning_content: 'is long.' }),
        chunk({ content: 'Reading it first.' }),
        chunk({
          tool_calls: [
            { index: 0, id: 'c1', function: { name: 'read_document', arguments: '{}' } },
          ],
        }),
        chunk({}, 'tool_calls'),
        { choices: [], usage: { prompt_tokens: 90, completion_tokens: 12, total_tokens: 102 } },
      ])
    );

    expect(await replyFrom(fetch)).toEqual([
      { type: 'reasoningStart' },
      { type: 'reasoningEnd', text: 'The summary is long.', durationMs: 500 },
      { type: 'textDelta', text: 'Reading it first.' },
      { type: 'toolCallStart', callId: 'c1', name: 'read_document' },
      { type: 'toolCall', callId: 'c1', name: 'read_document', args: {} },
      {
        type: 'finish',
        reason: 'complete',
        usage: { inputTokens: 90, outputTokens: 12, cachedInputTokens: undefined },
      },
    ]);

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(`${ADDRESS}/v1/chat/completions`);
    const body = JSON.parse(String(init?.body)) as { messages: object[]; stream_options: object };
    expect(body.stream_options).toEqual({ include_usage: true });
    expect(body.messages[2]).toEqual({ role: 'assistant', content: 'Reading it.' });
  });

  it('takes reasoning under the other name servers use', async () => {
    const events = await replyFrom(async () =>
      streamed([chunk({ reasoning: 'Thinking.' }), chunk({ content: 'Done.' }), chunk({}, 'stop')])
    );
    expect(events[1]).toMatchObject({ type: 'reasoningEnd', text: 'Thinking.' });
  });

  it('names the problems a user can fix from the server’s words, whatever its status', async () => {
    const said = (message: string) => JSON.stringify({ error: { message } });
    for (const [status, message, reason] of [
      [500, 'tools param requires --jinja flag', 'toolsUnsupported'],
      [
        400,
        '"auto" tool choice requires --enable-auto-tool-choice and --tool-call-parser to be set',
        'toolsUnsupported',
      ],
      [400, 'the request exceeds the available context size', 'context-too-long'],
      [400, "This model's maximum context length is 8192 tokens", 'context-too-long'],
      [404, 'The model `qwen3.5-9b` does not exist.', 'model-not-found'],
      [400, 'No models loaded. Please load a model.', 'model-not-found'],
      [401, 'Invalid API key', 'keyRefused'],
      [403, 'Forbidden', 'keyRefused'],
      [429, 'Too many requests', 'rateLimited'],
      [500, 'Out of memory', 'failed'],
    ] as const) {
      expect(await failingWith(status, said(message)), message).toEqual({
        reason,
        message,
        httpStatus: status,
      });
    }
  });

  it('quotes the server’s words in the other shapes they come in', async () => {
    expect(await failingWith(400, JSON.stringify({ error: 'Bad grammar' }))).toMatchObject({
      message: 'Bad grammar',
    });
    expect(await failingWith(502, 'Bad gateway')).toMatchObject({
      reason: 'failed',
      message: 'Bad gateway',
      httpStatus: 502,
    });
  });

  it('says when nothing answered, or the stream ends early', async () => {
    const [refused] = await replyFrom(async () => {
      throw new TypeError('fetch failed', { cause: new Error('connect ECONNREFUSED') });
    });
    expect(refused).toMatchObject({ type: 'error', error: { reason: 'unreachable' } });

    const events = await replyFrom(async () => streamed([chunk({ content: 'Par' })]));
    expect(events.at(-1)).toEqual({
      type: 'error',
      error: { reason: 'failed', message: 'The server stopped before the reply was finished' },
    });
  });
});
