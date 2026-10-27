import type { KeyedProvider } from '@shared/types/secrets';

/**
 * Where each provider's API is, as its SDK takes it: the SDK, or the model list, adds the
 * path. Requests go nowhere else.
 */
export const PROVIDER_API_URL: Record<KeyedProvider, string> = {
  openai: 'https://api.openai.com/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  anthropic: 'https://api.anthropic.com',
  gemini: 'https://generativelanguage.googleapis.com',
};

/** A model's reply, until it starts; once it streams, the loop's stall check watches it. */
export const REPLY_START_TIMEOUT_MS = 60_000;
