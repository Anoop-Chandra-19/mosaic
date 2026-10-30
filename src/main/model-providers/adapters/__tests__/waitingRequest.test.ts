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

describe('a request that gets no answer', () => {
  it.each(Object.keys(ADAPTERS))('%s ends quietly on its signal', async (name) => {
    const attempt = new AbortController();
    const provider = ADAPTERS[name](hangUntilAborted(() => attempt.abort()));

    const events = [];
    for await (const event of provider.streamReply(request(attempt.signal))) events.push(event);
    expect(events).toEqual([]);
  });
});
