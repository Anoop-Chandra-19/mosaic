import { describe, expect, it } from 'vitest';
import type { ModelProvider, ModelRequest } from '../../modelProvider';
import { createAnthropicModelProvider } from '../anthropicModelProvider';
import { createGoogleModelProvider } from '../googleModelProvider';
import { createOllamaModelProvider } from '../ollamaModelProvider';
import { createOpenAiCompatibleModelProvider } from '../openAiCompatibleModelProvider';
import { createOpenAiModelProvider } from '../openAiModelProvider';
import { createOpenRouterModelProvider } from '../openRouterModelProvider';

type HungFetch = (url: string, init?: { signal?: AbortSignal | null }) => Promise<Response>;

const ADAPTERS: Record<string, (fetch: HungFetch) => ModelProvider> = {
  OpenAI: (fetch) => createOpenAiModelProvider({ apiKey: 'test-key', fetch }),
  OpenRouter: (fetch) => createOpenRouterModelProvider({ apiKey: 'test-key', fetch }),
  Anthropic: (fetch) => createAnthropicModelProvider({ apiKey: 'test-key', fetch }),
  Google: (fetch) => createGoogleModelProvider({ apiKey: 'test-key', fetch }),
  Ollama: (fetch) => createOllamaModelProvider({ address: 'http://127.0.0.1:11434', fetch }),
  'OpenAI-compatible': (fetch) =>
    createOpenAiCompatibleModelProvider({ address: 'http://127.0.0.1:8080', fetch }),
};

const request = (signal: AbortSignal): ModelRequest => ({
  model: 'a-model',
  system: 'You help with resumes.',
  messages: [{ role: 'user', text: 'Tighten my summary.' }],
  tools: [],
  cacheKey: 'mosaic-conversation-1',
  signal,
});

/** A server that never answers, as the loop's stall check meets it: only the signal ends it. */
function hangUntilAborted(onSent: () => void): HungFetch {
  return (_url, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('', 'AbortError')));
      onSent();
    });
}

const sse = (...pieces: object[]) =>
  pieces.map((piece) => `data: ${JSON.stringify(piece)}\n\n`).join('');

/** Three pieces of each provider's stream that hold nothing to show yet. */
const SILENT_STREAMS: Record<string, string> = {
  OpenAI: sse(
    ...Array.from({ length: 3 }, () => ({
      type: 'response.function_call_arguments.delta',
      item_id: 'fc_1',
      delta: '{',
    }))
  ),
  OpenRouter: sse({ choices: [] }, { choices: [] }, { choices: [] }),
  Anthropic: Array.from(
    { length: 3 },
    () =>
      'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"Hmm"}}\n\n'
  ).join(''),
  Google: sse({ candidates: [] }, { candidates: [] }, { candidates: [] }),
  Ollama: '{"message":{"thinking":"Hmm"}}\n'.repeat(3),
  'OpenAI-compatible': sse({ choices: [] }, { choices: [] }, { choices: [] }),
};

describe('a stream that says nothing yet', () => {
  it.each(Object.keys(ADAPTERS))('%s still says that each piece arrived', async (name) => {
    let arrivals = 0;
    const provider = ADAPTERS[name](
      async () =>
        new Response(SILENT_STREAMS[name], { headers: { 'content-type': 'text/event-stream' } })
    );
    const silent = {
      ...request(new AbortController().signal),
      onArrival: () => (arrivals += 1),
    };
    for await (const event of provider.streamReply(silent)) void event;
    expect(arrivals).toBe(3);
  });
});

describe('a request that gets no answer', () => {
  it.each(Object.keys(ADAPTERS))('%s ends quietly on its signal', async (name) => {
    const attempt = new AbortController();
    const provider = ADAPTERS[name](hangUntilAborted(() => attempt.abort()));

    const events = [];
    for await (const event of provider.streamReply(request(attempt.signal))) events.push(event);
    expect(events).toEqual([]);
  });
});
