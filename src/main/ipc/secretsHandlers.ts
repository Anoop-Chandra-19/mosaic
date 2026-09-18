import {
  KEYED_PROVIDERS,
  MAX_KEY_LENGTH,
  type KeyedProvider,
  type KeyLocation,
  type KeyTest,
  type MosaicSecrets,
} from '@shared/types/secrets';
import { KeychainError, type ApiKeys } from '../secrets/apiKeys';

/*
 * Main's side of `MosaicSecrets`, kept free of Electron so tests can drive it directly;
 * `./secrets.ts` wires it to IPC. Refusals never quote the key they refuse.
 */

/** Every argument arrives unchecked. */
export type SecretsHandlers = {
  [K in keyof MosaicSecrets]: MosaicSecrets[K] extends (...args: infer A) => infer R
    ? (...args: { [I in keyof A]: unknown }) => R
    : never;
};

/** A key test against the provider, given a key that has already been checked. */
export type TestKey = (provider: KeyedProvider, key: string, model: string) => Promise<KeyTest>;

function keyedProvider(value: unknown): KeyedProvider {
  if (!KEYED_PROVIDERS.includes(value as KeyedProvider)) {
    throw new Error('provider must be one that takes an API key');
  }
  return value as KeyedProvider;
}

function apiKey(value: unknown): string {
  const key = typeof value === 'string' ? value.trim() : '';
  if (key === '' || key.length > MAX_KEY_LENGTH || /\s/.test(key)) {
    throw new Error(`key must be 1–${MAX_KEY_LENGTH} characters with no spaces or line breaks`);
  }
  return key;
}

function keyLocation(value: unknown): KeyLocation {
  if (value !== 'keychain' && value !== 'session') {
    throw new Error('location must be keychain or session');
  }
  return value;
}

function modelName(value: unknown): string {
  const model = typeof value === 'string' ? value.trim() : '';
  if (model === '' || model.length > 200) throw new Error('model must be text of 1–200 characters');
  return model;
}

export function createSecretsHandlers(keys: ApiKeys, testKey: TestKey): SecretsHandlers {
  return {
    status: () => keys.status(),
    save: (provider, key) => keys.save(keyedProvider(provider), apiKey(key)),
    remove: (provider) => keys.remove(keyedProvider(provider)),
    setLocation: (location) => keys.setLocation(keyLocation(location)),
    forgetAll: () => keys.forgetAll(),
    test: async (provider, model, key) => {
      const checked = keyedProvider(provider);
      const name = modelName(model);
      let secret: string | undefined;
      try {
        // No key: test the saved one. IPC may carry a missing argument as null.
        secret = key === undefined || key === null ? await keys.read(checked) : apiKey(key);
      } catch (error) {
        if (error instanceof KeychainError) return { ok: false, reason: 'keychain' };
        throw error;
      }
      if (secret === undefined) return { ok: false, reason: 'no-key' };
      return testKey(checked, secret, name);
    },
  };
}
