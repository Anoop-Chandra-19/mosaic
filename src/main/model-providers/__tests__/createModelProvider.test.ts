import { describe, expect, it, vi } from 'vitest';
import type { ModelProviderRefusal } from '@shared/types/agentBridge';
import type { ModelProviderId } from '@shared/types/modelProviders';
import { KeychainError } from '../../secrets/apiKeys';
import {
  createModelProvider,
  type ModelChoice,
  type ModelProviderNeeds,
} from '../createModelProvider';
import type { OpenAiFetch } from '../openAiModelProvider';

const choice = (provider: ModelProviderId): ModelChoice => ({
  provider,
  model: 'gpt-5.6-terra',
  ollama: { address: 'http://127.0.0.1:11434', contextTokens: null },
});

type ReadApiKey = ModelProviderNeeds['readApiKey'];

function needs(readApiKey: ReadApiKey) {
  const fetch = vi.fn<OpenAiFetch>(async () => new Response('', { status: 500 }));
  return { fetch, readApiKey };
}

const lockedKeychain: ReadApiKey = async () => {
  throw new KeychainError('locked');
};

const REFUSALS: [string, ModelProviderId, ReadApiKey, ModelProviderRefusal][] = [
  ['a provider this build can’t run', 'openrouter', async () => 'sk-or-1', 'providerNotSupported'],
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

  it('opens Ollama without asking for a key', async () => {
    const readApiKey = vi.fn(async () => undefined);
    expect(await createModelProvider(choice('ollama'), needs(readApiKey))).toMatchObject({
      ok: true,
    });
    expect(readApiKey).not.toHaveBeenCalled();
  });

  it('opens OpenAI with the saved key', async () => {
    const opened = needs(async () => 'sk-test-0000');
    const created = await createModelProvider(choice('openai'), opened);
    if (!created.ok) throw new Error('not opened');
    const request = {
      model: 'gpt-5.6-terra',
      system: '',
      messages: [],
      tools: [],
      cacheKey: 'mosaic-conversation-1',
      signal: new AbortController().signal,
    };
    await created.modelProvider.streamReply(request)[Symbol.asyncIterator]().next();

    const [url, init] = opened.fetch.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/responses');
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer sk-test-0000');
  });
});
