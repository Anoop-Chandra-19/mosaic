import type { KeyedProvider } from '@shared/types/secrets';
import {
  listModels,
  readFailure,
  requestWithKey,
  type ModelListAnswer,
  type ModelListFetch,
} from './listModels';

/** What the provider said about a key, with the reasons `KeyCheck` gives. Never echoes the key. */
export type KeyTest = ModelListAnswer;

/**
 * Asks the provider whether `key` works, by listing the models it can use: a request that
 * needs a valid key and costs no tokens, and whose answer Settings keeps as the key's list.
 * OpenRouter's list is public, so there the key is asked about first.
 * Every outcome is data; this never throws.
 */
export async function testApiKey(
  provider: KeyedProvider,
  key: string,
  fetch: ModelListFetch
): Promise<KeyTest> {
  if (provider === 'openrouter') {
    const response = await requestWithKey(
      'https://openrouter.ai/api/v1/key',
      { Authorization: `Bearer ${key}` },
      fetch
    );
    if (!(response instanceof Response)) return response;
    const failure = await readFailure(response);
    if (failure) return failure;
  }
  return listModels(provider, key, fetch);
}
