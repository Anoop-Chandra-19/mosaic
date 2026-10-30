import { describe, expect, it, vi } from 'vitest';
import type { ModelProviderRefusal } from '@shared/types/agentBridge';
import type { ModelProviderId } from '@shared/types/modelProviders';
import { KeychainError } from '../../secrets/apiKeys';
import {
  createModelProvider,
  type ModelChoice,
  type ModelProviderNeeds,
} from '../createModelProvider';
import type { OpenAiFetch } from '../adapters/openAiClient';

const choice = (provider: ModelProviderId): ModelChoice => ({
  provider,
  model: 'gpt-5.6-terra',
  ollama: { address: 'http://127.0.0.1:11434', contextTokens: null },
  openAiCompatible: { address: 'http://127.0.0.1:8080' },
});

const REQUEST = {
  model: 'gpt-5.6-terra',
  system: '',
  messages: [{ role: 'user' as const, text: 'Tighten my summary.' }],
  tools: [],
  cacheKey: 'mosaic-conversation-1',
  signal: new AbortController().signal,
};

type ReadApiKey = ModelProviderNeeds['readApiKey'];

function needs(readApiKey: ReadApiKey) {
  const fetch = vi.fn<OpenAiFetch>(async () => new Response('', { status: 500 }));
  return { fetch, readApiKey };
}

const lockedKeychain: ReadApiKey = async () => {
  throw new KeychainError('locked');
};

const REFUSALS: [string, ModelProviderId, ReadApiKey, ModelProviderRefusal][] = [
  ['no saved key', 'openai', async () => undefined, 'noApiKey'],
  ['a keychain that won’t give the key back', 'openai', lockedKeychain, 'keychainRefused'],
];

describe('createModelProvider', () => {
  it.each(REFUSALS)('refuses %s', async (_name, provider, readApiKey, reason) => {
    expect(await createModelProvider(choice(provider), needs(readApiKey))).toEqual({
      ok: false,
      reason,
    });
  });

  it.each([
    ['ollama', 'http://127.0.0.1:11434/api/chat'],
    ['openaiCompatible', 'http://127.0.0.1:8080/v1/chat/completions'],
  ] as const)('opens %s at its address without asking for a key', async (provider, expectedUrl) => {
    const readApiKey = vi.fn(async () => undefined);
    const opened = needs(readApiKey);
    const created = await createModelProvider(choice(provider), opened);
    if (!created.ok) throw new Error('not opened');
    await created.modelProvider.streamReply(REQUEST)[Symbol.asyncIterator]().next();

    expect(opened.fetch.mock.calls[0][0]).toBe(expectedUrl);
    expect(readApiKey).not.toHaveBeenCalled();
  });

  it.each([
    ['openai', 'https://api.openai.com/v1/responses', 'authorization', 'Bearer sk-test-0000'],
    ['anthropic', 'https://api.anthropic.com/v1/messages', 'authorization', 'Bearer sk-test-0000'],
    [
      'google',
      'https://generativelanguage.googleapis.com/v1beta/models/gpt-5.6-terra:streamGenerateContent?alt=sse',
      'x-goog-api-key',
      'sk-test-0000',
    ],
  ] as const)('opens %s with the saved key', async (provider, expectedUrl, header, sent) => {
    const opened = needs(async () => 'sk-test-0000');
    const created = await createModelProvider(choice(provider), opened);
    if (!created.ok) throw new Error('not opened');
    await created.modelProvider.streamReply(REQUEST)[Symbol.asyncIterator]().next();

    const [url, init] = opened.fetch.mock.calls[0];
    expect(url).toBe(expectedUrl);
    expect(new Headers(init?.headers).get(header)).toBe(sent);
  });
});
