import {
  KEYED_PROVIDERS,
  MAX_KEY_LENGTH,
  type KeyCheck,
  type KeyedProvider,
  type MosaicSecrets,
  type SaveKeyOptions,
} from '@shared/types/secrets';
import type { KeyTest } from '../model-providers/testApiKey';
import { KeychainError, type ApiKeys } from '../secrets/apiKeys';

/*
 * Main's side of `MosaicSecrets`, kept free of Electron so tests can drive it directly;
 * `./registerSecretsHandlers.ts` wires it to IPC. Refusals never quote the key they refuse.
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

function modelName(value: unknown): string {
  const model = typeof value === 'string' ? value.trim() : '';
  if (model === '' || model.length > 200) throw new Error('model must be text of 1–200 characters');
  return model;
}

function saveKeyOptions(value: unknown): SaveKeyOptions {
  const options = value as Partial<Record<keyof SaveKeyOptions, unknown>> | null;
  if (typeof options?.check !== 'boolean' || typeof options.forgetOnClose !== 'boolean') {
    throw new Error('options must say whether to check the key and whether to forget it');
  }
  return {
    model: modelName(options.model),
    check: options.check,
    forgetOnClose: options.forgetOnClose,
  };
}

export function createSecretsHandlers(keys: ApiKeys, testKey: TestKey): SecretsHandlers {
  return {
    status: () => keys.status(),

    save: async (provider, key, options): Promise<KeyCheck> => {
      const checked = keyedProvider(provider);
      const secret = apiKey(key);
      const { model, check, forgetOnClose } = saveKeyOptions(options);
      if (!check) {
        const status = await keys.save(checked, secret, { forgetOnClose, checked: false });
        return { ok: true, status, modelFound: null };
      }
      // A key already saved stays in place until this one passes.
      const test = await testKey(checked, secret, model);
      if (!test.ok) return test;
      const status = await keys.save(checked, secret, { forgetOnClose, checked: true });
      return { ok: true, status, modelFound: test.modelFound };
    },

    check: async (provider, model): Promise<KeyCheck> => {
      const checked = keyedProvider(provider);
      const name = modelName(model);
      const saved = (await keys.status()).saved[checked];
      if (!saved) return { ok: false, reason: 'no-key' };
      let secret: string | undefined;
      try {
        secret = await keys.read(checked);
      } catch (error) {
        if (error instanceof KeychainError) return { ok: false, reason: 'keychain' };
        throw error;
      }
      if (secret === undefined) return { ok: false, reason: 'no-key' };
      const test = await testKey(checked, secret, name);
      if (!test.ok) return test;
      const status = await keys.markChecked(checked, saved.savedAt);
      return { ok: true, status, modelFound: test.modelFound };
    },

    remove: (provider) => keys.remove(keyedProvider(provider)),
    forgetAll: () => keys.forgetAll(),
  };
}
