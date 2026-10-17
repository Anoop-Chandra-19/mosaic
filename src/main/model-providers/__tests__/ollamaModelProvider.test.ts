import { describe, expect, it } from 'vitest';
import type { ModelStreamEvent } from '@shared/types/modelReply';
import type { ModelRequest } from '../modelProvider';
import { createOllamaModelProvider } from '../ollamaModelProvider';
import type { OllamaFetch } from '../ollamaModels';

const OLLAMA_URL = 'http://127.0.0.1:11434';

const TOOL = {
  name: 'read_document',
  description: 'Read the open resume.',
  inputSchema: { type: 'object', properties: {} },
};

const DONE = {
  message: { role: 'assistant', content: '' },
  done: true,
  done_reason: 'stop',
  prompt_eval_count: 277,
  eval_count: 26,
};

function request(overrides: Partial<ModelRequest> = {}): ModelRequest {
  return {
    model: 'qwen3.5:9b',
    system: 'You help with resumes.',
    messages: [{ role: 'user', text: 'Tighten my summary.' }],
    tools: [TOOL],
    signal: new AbortController().signal,
    ...overrides,
  };
}

/** Streamed lines, cut into chunks of `chunkBytes` so lines and characters arrive split. */
function streamed(lines: unknown[], chunkBytes = Infinity): Response {
  const bytes = new TextEncoder().encode(lines.map((line) => JSON.stringify(line) + '\n').join(''));
  return new Response(
    new ReadableStream({
      start(controller) {
        for (let start = 0; start < bytes.length; start += chunkBytes) {
          controller.enqueue(bytes.slice(start, start + chunkBytes));
        }
        controller.close();
      },
    })
  );
}

/** An Ollama whose `/api/chat` answers with `chat`, remembering every body it was sent. */
function ollama(chat: () => Response | Promise<Response>) {
  const sent: { url: string; body: Record<string, unknown> }[] = [];
  const fetch: OllamaFetch = async (url, init) => {
    sent.push({ url, body: JSON.parse(init.body ?? '{}') });
    return chat();
  };
  return { fetch, sent };
}

async function collect(events: AsyncIterable<ModelStreamEvent>): Promise<ModelStreamEvent[]> {
  const collected: ModelStreamEvent[] = [];
  for await (const event of events) collected.push(event);
  return collected;
}

function clock(...times: number[]) {
  return () => times.shift() ?? 0;
}

describe('createOllamaModelProvider', () => {
  it('streams text and finishes with the token counts', async () => {
    const lines = [
      { message: { role: 'assistant', content: 'Led a team ' } },
      { message: { role: 'assistant', content: 'of five — ünïcode too.' } },
      DONE,
    ];
    for (const chunkBytes of [Infinity, 7, 1]) {
      const { fetch } = ollama(() => streamed(lines, chunkBytes));
      const provider = createOllamaModelProvider({ address: OLLAMA_URL, fetch });
      expect(await collect(provider.streamReply(request())), `${chunkBytes}`).toEqual([
        { type: 'textDelta', text: 'Led a team ' },
        { type: 'textDelta', text: 'of five — ünïcode too.' },
        {
          type: 'finish',
          reason: 'complete',
          usage: { inputTokens: 277, outputTokens: 26 },
        },
      ]);
    }
  });

  it('passes tool calls on with their ids, and makes one up when Ollama has none', async () => {
    const { fetch } = ollama(() =>
      streamed([
        {
          message: {
            role: 'assistant',
            content: '',
            tool_calls: [
              { id: 'call_ku5s89ut', function: { index: 0, name: 'read_document', arguments: {} } },
              { function: { name: 'propose_rewrite', arguments: { bulletId: 'b1', text: 'x' } } },
            ],
          },
        },
        DONE,
      ])
    );
    const events = await collect(
      createOllamaModelProvider({ address: OLLAMA_URL, fetch }).streamReply(request())
    );
    expect(events.slice(0, 2)).toEqual([
      { type: 'toolCall', callId: 'call_ku5s89ut', name: 'read_document', args: {} },
      {
        type: 'toolCall',
        callId: expect.any(String),
        name: 'propose_rewrite',
        args: { bulletId: 'b1', text: 'x' },
      },
    ]);
  });

  it('times the thinking a model does anyway, and keeps its text', async () => {
    const { fetch } = ollama(() =>
      streamed([
        { message: { role: 'assistant', content: '', thinking: 'The summary ' } },
        { message: { role: 'assistant', content: '', thinking: 'is long.' } },
        { message: { role: 'assistant', content: 'Shorter.' } },
        DONE,
      ])
    );
    const provider = createOllamaModelProvider({
      address: OLLAMA_URL,
      fetch,
      now: clock(1000, 4400),
    });
    expect((await collect(provider.streamReply(request()))).slice(0, 3)).toEqual([
      { type: 'reasoningStart' },
      { type: 'reasoningEnd', text: 'The summary is long.', durationMs: 3400 },
      { type: 'textDelta', text: 'Shorter.' },
    ]);
  });

  it('says when the reply hit the output limit', async () => {
    const { fetch } = ollama(() => streamed([{ ...DONE, done_reason: 'length' }]));
    const events = await collect(
      createOllamaModelProvider({ address: OLLAMA_URL, fetch }).streamReply(request())
    );
    expect(events).toEqual([
      { type: 'finish', reason: 'outputLimit', usage: { inputTokens: 277, outputTokens: 26 } },
    ]);
  });

  it('sends thinking off, the tools, and the conversation in Ollama’s shape', async () => {
    const { fetch, sent } = ollama(() => streamed([DONE]));
    await collect(
      createOllamaModelProvider({ address: OLLAMA_URL, fetch }).streamReply(
        request({
          messages: [
            { role: 'user', text: 'Tighten my summary.' },
            {
              role: 'assistant',
              parts: [
                { type: 'reasoning', text: 'Read it first.', durationMs: 900 },
                { type: 'text', text: 'Reading it.' },
                { type: 'toolCall', callId: 'call_1', name: 'read_document', args: {} },
              ],
            },
            {
              role: 'toolResult',
              callId: 'call_1',
              toolName: 'read_document',
              content: '{"summary":"…"}',
            },
          ],
        })
      )
    );
    expect(sent.map((s) => s.url)).toEqual([`${OLLAMA_URL}/api/chat`]);
    expect(sent[0].body).toEqual({
      model: 'qwen3.5:9b',
      stream: true,
      think: false,
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
      messages: [
        { role: 'system', content: 'You help with resumes.' },
        { role: 'user', content: 'Tighten my summary.' },
        {
          role: 'assistant',
          content: 'Reading it.',
          thinking: 'Read it first.',
          tool_calls: [{ id: 'call_1', function: { name: 'read_document', arguments: {} } }],
        },
        {
          role: 'tool',
          tool_name: 'read_document',
          tool_call_id: 'call_1',
          content: '{"summary":"…"}',
        },
      ],
    });
  });

  it('leaves the context window to Ollama unless the user chose one', async () => {
    const { fetch, sent } = ollama(() => streamed([DONE]));
    await collect(createOllamaModelProvider({ address: OLLAMA_URL, fetch }).streamReply(request()));
    await collect(
      createOllamaModelProvider({ address: OLLAMA_URL, fetch, contextTokens: 16_384 }).streamReply(
        request()
      )
    );
    expect(sent.map((s) => s.body.options)).toEqual([undefined, { num_ctx: 16_384 }]);
  });

  it('says when nothing is listening', async () => {
    const refused: OllamaFetch = () => Promise.reject(new TypeError('connect ECONNREFUSED'));
    const events = await collect(
      createOllamaModelProvider({ address: OLLAMA_URL, fetch: refused }).streamReply(request())
    );
    expect(events).toEqual([{ type: 'error', error: { reason: 'unreachable' } }]);
  });

  it('says when the model isn’t pulled', async () => {
    const { fetch } = ollama(() =>
      Response.json({ error: "model 'qwen3.5:9b' not found" }, { status: 404 })
    );
    const events = await collect(
      createOllamaModelProvider({ address: OLLAMA_URL, fetch }).streamReply(request())
    );
    expect(events).toEqual([{ type: 'error', error: { reason: 'model-not-found' } }]);
  });

  it('says when the conversation is too long for the model', async () => {
    const { fetch } = ollama(() =>
      Response.json({ error: 'input length exceeds the context length' }, { status: 400 })
    );
    const events = await collect(
      createOllamaModelProvider({ address: OLLAMA_URL, fetch }).streamReply(request())
    );
    expect(events).toEqual([{ type: 'error', error: { reason: 'context-too-long' } }]);
  });

  it('keeps the message of any other error, before or during the reply', async () => {
    const before = ollama(() => new Response('upstream gone', { status: 502 }));
    expect(
      await collect(
        createOllamaModelProvider({ address: OLLAMA_URL, fetch: before.fetch }).streamReply(
          request()
        )
      )
    ).toEqual([
      { type: 'error', error: { reason: 'failed', message: 'upstream gone', httpStatus: 502 } },
    ]);

    const during = ollama(() =>
      streamed([{ message: { role: 'assistant', content: 'Led' } }, { error: 'GPU out of memory' }])
    );
    expect(
      await collect(
        createOllamaModelProvider({ address: OLLAMA_URL, fetch: during.fetch }).streamReply(
          request()
        )
      )
    ).toEqual([
      { type: 'textDelta', text: 'Led' },
      { type: 'error', error: { reason: 'failed', message: 'GPU out of memory' } },
    ]);
  });

  it('fails a reply that stops before it is done', async () => {
    const { fetch } = ollama(() => streamed([{ message: { role: 'assistant', content: 'Led' } }]));
    const events = await collect(
      createOllamaModelProvider({ address: OLLAMA_URL, fetch }).streamReply(request())
    );
    expect(events.at(-1)).toEqual({
      type: 'error',
      error: { reason: 'failed', message: 'Ollama stopped before the reply was finished' },
    });
  });

  it('ends quietly when the request is cancelled', async () => {
    const controller = new AbortController();
    controller.abort();
    const cancelled: OllamaFetch = () =>
      Promise.reject(new DOMException('The operation was aborted.', 'AbortError'));
    const events = await collect(
      createOllamaModelProvider({ address: OLLAMA_URL, fetch: cancelled }).streamReply(
        request({ signal: controller.signal })
      )
    );
    expect(events).toEqual([]);
  });
});
