import type { KeyedProvider } from '@shared/types/secrets';

/**
 * Where each provider's API is, as its SDK takes it: the SDK, or the model list, adds the
 * path. Requests go nowhere else.
 */
export const PROVIDER_API_URL: Record<KeyedProvider, string> = {
  openai: 'https://api.openai.com/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  anthropic: 'https://api.anthropic.com',
  google: 'https://generativelanguage.googleapis.com',
};

/**
 * A key check or a provider's model list, over the internet. Replies have no timeout here:
 * the loop's stall check (`RUN_LIMITS.stallMs`) covers every provider.
 */
export const MODEL_LIST_TIMEOUT_MS = 10_000;

/** A model list from a server the user runs, usually on this computer. */
export const SERVER_MODELS_TIMEOUT_MS = 3000;
