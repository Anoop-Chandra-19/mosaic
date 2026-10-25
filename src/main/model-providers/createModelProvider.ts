import type { ModelProviderRefusal } from '@shared/types/agentBridge';
import type { ModelProviderId } from '@shared/types/modelProviders';
import { isKeyedProvider, type KeyedProvider } from '@shared/types/secrets';
import { KeychainError } from '../secrets/apiKeys';
import type { ModelProvider } from './modelProvider';
import { createOllamaModelProvider } from './ollamaModelProvider';
import type { OllamaFetch } from './ollamaModels';
import { createOpenAiModelProvider, type OpenAiFetch } from './openAiModelProvider';

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
}

export interface ModelProviderNeeds {
  /** Main passes Electron's `net.fetch`, which serves every provider. */
  fetch: OllamaFetch & OpenAiFetch;
  /** The saved key; rejects with `KeychainError` if the keychain won't give it back. */
  readApiKey: (provider: KeyedProvider) => Promise<string | undefined>;
}

export type ModelProviderOpening =
  | { ok: true; modelProvider: ModelProvider }
  | { ok: false; reason: ModelProviderRefusal };

type CreateKeyedProvider = (apiKey: string, fetch: OpenAiFetch) => ModelProvider;

/** Null for a provider whose adapter this build doesn't have yet. */
const CREATE_KEYED_PROVIDER: Record<KeyedProvider, CreateKeyedProvider | null> = {
  openai: (apiKey, fetch) => createOpenAiModelProvider({ apiKey, fetch }),
  openrouter: null,
  anthropic: null,
  gemini: null,
};

export const isModelProviderId = (value: unknown): value is ModelProviderId =>
  value === 'ollama' || (typeof value === 'string' && Object.hasOwn(CREATE_KEYED_PROVIDER, value));

const refused = (reason: ModelProviderRefusal): ModelProviderOpening => ({ ok: false, reason });

/**
 * The provider a run talks to, with its saved key read as the run starts (the keychain may
 * ask first). Refused when this build can't run the chosen provider yet, or there's no key.
 */
export async function createModelProvider(
  { provider, ollama }: ModelChoice,
  { fetch, readApiKey }: ModelProviderNeeds
): Promise<ModelProviderOpening> {
  if (!isKeyedProvider(provider)) {
    const contextTokens = ollama.contextTokens ?? undefined;
    const modelProvider = createOllamaModelProvider({
      address: ollama.address,
      fetch,
      contextTokens,
    });
    return { ok: true, modelProvider };
  }
  const create = CREATE_KEYED_PROVIDER[provider];
  if (!create) return refused('providerNotSupported');
  let apiKey: string | undefined;
  try {
    apiKey = await readApiKey(provider);
  } catch (error) {
    if (error instanceof KeychainError) return refused('keychainRefused');
    throw error;
  }
  if (!apiKey) return refused('noApiKey');
  return { ok: true, modelProvider: create(apiKey, fetch) };
}
