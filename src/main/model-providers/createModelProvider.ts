import type { ModelProviderRefusal } from '@shared/types/agentBridge';
import type { ModelProviderId } from '@shared/types/modelProviders';
import type { KeyedProvider } from '@shared/types/secrets';
import { KeychainError } from '../secrets/apiKeys';
import {
  createAnthropicModelProvider,
  type AnthropicFetch,
} from './adapters/anthropicModelProvider';
import { createGoogleModelProvider, type GoogleFetch } from './adapters/googleModelProvider';
import { createOllamaModelProvider } from './adapters/ollamaModelProvider';
import type { OpenAiFetch } from './adapters/openAiClient';
import { createOpenAiCompatibleModelProvider } from './adapters/openAiCompatibleModelProvider';
import { createOpenAiModelProvider } from './adapters/openAiModelProvider';
import { createOpenRouterModelProvider } from './adapters/openRouterModelProvider';
import type { OllamaFetch } from './model-lists/ollamaModels';
import type { ModelProvider } from './modelProvider';

/** The provider and model a run uses, as the user chose them in Settings. */
export interface ModelChoice {
  provider: ModelProviderId;
  model: string;
  ollama: {
    /** Already checked with `normalizeOllamaAddress`. */
    address: string;
    /** Null leaves the window to Ollama's own setting. */
    contextTokens: number | null;
  };
  openAiCompatible: {
    /** Already checked with `normalizeOpenAiCompatibleAddress`. */
    address: string;
  };
}

export interface ModelProviderNeeds {
  /** Main passes Electron's `net.fetch`, which serves every provider. */
  fetch: OllamaFetch & KeyedFetch;
  /** The saved key; rejects with `KeychainError` if the keychain won't give it back. */
  readApiKey: (provider: KeyedProvider) => Promise<string | undefined>;
}

export type ModelProviderOpening =
  | { ok: true; modelProvider: ModelProvider }
  | { ok: false; reason: ModelProviderRefusal };

type KeyedFetch = OpenAiFetch & AnthropicFetch & GoogleFetch;

type CreateKeyedProvider = (apiKey: string, fetch: KeyedFetch) => ModelProvider;

const CREATE_KEYED_PROVIDER: Record<KeyedProvider, CreateKeyedProvider> = {
  openai: (apiKey, fetch) => createOpenAiModelProvider({ apiKey, fetch }),
  openrouter: (apiKey, fetch) => createOpenRouterModelProvider({ apiKey, fetch }),
  anthropic: (apiKey, fetch) => createAnthropicModelProvider({ apiKey, fetch }),
  google: (apiKey, fetch) => createGoogleModelProvider({ apiKey, fetch }),
};

export const isModelProviderId = (value: unknown): value is ModelProviderId =>
  value === 'ollama' ||
  value === 'openaiCompatible' ||
  (typeof value === 'string' && Object.hasOwn(CREATE_KEYED_PROVIDER, value));

const refused = (reason: ModelProviderRefusal): ModelProviderOpening => ({ ok: false, reason });

/**
 * The provider a run talks to, with its saved key read as the run starts (the keychain may
 * ask first). Refused when there's no key, or the keychain won't give it back.
 */
export async function createModelProvider(
  { provider, ollama, openAiCompatible }: ModelChoice,
  { fetch, readApiKey }: ModelProviderNeeds
): Promise<ModelProviderOpening> {
  if (provider === 'ollama') {
    const contextTokens = ollama.contextTokens ?? undefined;
    const modelProvider = createOllamaModelProvider({
      address: ollama.address,
      fetch,
      contextTokens,
    });
    return { ok: true, modelProvider };
  }
  if (provider === 'openaiCompatible') {
    const { address } = openAiCompatible;
    return { ok: true, modelProvider: createOpenAiCompatibleModelProvider({ address, fetch }) };
  }
  let apiKey: string | undefined;
  try {
    apiKey = await readApiKey(provider);
  } catch (error) {
    if (error instanceof KeychainError) return refused('keychainRefused');
    throw error;
  }
  if (!apiKey) return refused('noApiKey');
  return { ok: true, modelProvider: CREATE_KEYED_PROVIDER[provider](apiKey, fetch) };
}
