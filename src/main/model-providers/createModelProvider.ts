import type { ModelProviderId } from '@shared/types/modelProviders';
import type { ModelProvider } from './modelProvider';
import { createOllamaModelProvider } from './ollamaModelProvider';
import type { OllamaFetch } from './ollamaModels';

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
  fetch: OllamaFetch;
}

type CreateProvider = (choice: ModelChoice, needs: ModelProviderNeeds) => ModelProvider;

/** Null for a provider whose adapter this build doesn't have yet. */
const CREATE_PROVIDER: Record<ModelProviderId, CreateProvider | null> = {
  ollama: ({ ollama }, { fetch }) =>
    createOllamaModelProvider({
      address: ollama.address,
      fetch,
      contextTokens: ollama.contextTokens ?? undefined,
    }),
  openai: null,
  openrouter: null,
  anthropic: null,
  gemini: null,
};

export const isModelProviderId = (value: unknown): value is ModelProviderId =>
  typeof value === 'string' && Object.hasOwn(CREATE_PROVIDER, value);

/** The provider a run talks to; null when this build can't run the chosen one yet. */
export function createModelProvider(
  choice: ModelChoice,
  needs: ModelProviderNeeds
): ModelProvider | null {
  return CREATE_PROVIDER[choice.provider]?.(choice, needs) ?? null;
}
