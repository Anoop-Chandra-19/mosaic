import {
  KEYED_PROVIDERS,
  MAX_KEY_LENGTH,
  type KeyCheck,
  type KeyedProvider,
  type ModelList,
  type ModelListing,
  type MosaicSecrets,
  type SaveKeyOptions,
} from '@shared/types/secrets';
import type { ProviderModels } from '../model-providers/model-lists/listModels';
import type { KeyTest } from '../model-providers/model-lists/testApiKey';
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

/** A key test against the provider, given a key whose form has already been checked. */
export type TestKey = (provider: KeyedProvider, key: string) => Promise<KeyTest>;

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

function saveKeyOptions(value: unknown): SaveKeyOptions {
  const options = value as Partial<Record<keyof SaveKeyOptions, unknown>> | null;
  if (typeof options?.check !== 'boolean' || typeof options.forgetOnClose !== 'boolean') {
    throw new Error('options must say whether to check the key and whether to forget it');
  }
  return { check: options.check, forgetOnClose: options.forgetOnClose };
}

type SavedKeyRead =
  | { ok: true; key: string; savedAt: number }
  | { ok: false; reason: 'no-key' | 'keychain' };

export function createSecretsHandlers(
  keys: ApiKeys,
  testKey: TestKey,
  now: () => number = Date.now
): SecretsHandlers {
  /** The last list each key gave, by the key's `savedAt`: a key saved since makes it stale. */
  const lists = new Map<KeyedProvider, { savedAt: number; list: ModelList }>();

  const keepList = (provider: KeyedProvider, savedAt: number, models: ProviderModels) => {
    const list: ModelList = {
      models: models.models,
      hiddenCount: models.hiddenCount,
      listedAt: now(),
    };
    lists.set(provider, { savedAt, list });
    return list;
  };

  const readSavedKey = async (provider: KeyedProvider): Promise<SavedKeyRead> => {
    const saved = (await keys.status()).saved[provider];
    if (!saved) return { ok: false, reason: 'no-key' };
    let key: string | undefined;
    try {
      key = await keys.read(provider);
    } catch (error) {
      if (error instanceof KeychainError) return { ok: false, reason: 'keychain' };
      throw error;
    }
    if (key === undefined) return { ok: false, reason: 'no-key' };
    return { ok: true, key, savedAt: saved.savedAt };
  };

  return {
    status: () => keys.status(),

    save: async (provider, key, options): Promise<KeyCheck> => {
      const checked = keyedProvider(provider);
      const secret = apiKey(key);
      const { check, forgetOnClose } = saveKeyOptions(options);
      if (!check) {
        const status = await keys.save(checked, secret, { forgetOnClose, checked: false });
        return { ok: true, status };
      }
      // A key already saved stays in place until this one passes.
      const test = await testKey(checked, secret);
      if (!test.ok) return test;
      const status = await keys.save(checked, secret, { forgetOnClose, checked: true });
      const savedAt = status.saved[checked]?.savedAt;
      if (savedAt !== undefined) keepList(checked, savedAt, test);
      return { ok: true, status };
    },

    check: async (provider): Promise<KeyCheck> => {
      const checked = keyedProvider(provider);
      const saved = await readSavedKey(checked);
      if (!saved.ok) return saved;
      const test = await testKey(checked, saved.key);
      if (!test.ok) return test;
      keepList(checked, saved.savedAt, test);
      const status = await keys.markChecked(checked, saved.savedAt);
      return { ok: true, status };
    },

    listModels: async (provider, refresh): Promise<ModelListing> => {
      const checked = keyedProvider(provider);
      if (typeof refresh !== 'boolean') throw new Error('refresh must be true or false');
      // Status first: a kept list is answered without asking the keychain for the key.
      const savedAt = (await keys.status()).saved[checked]?.savedAt;
      const kept = lists.get(checked);
      if (!refresh && kept && kept.savedAt === savedAt) return { ok: true, list: kept.list };
      const saved = await readSavedKey(checked);
      if (!saved.ok) return saved;
      const test = await testKey(checked, saved.key);
      if (!test.ok) return test;
      return { ok: true, list: keepList(checked, saved.savedAt, test) };
    },

    remove: (provider) => keys.remove(keyedProvider(provider)),
    forgetAll: () => keys.forgetAll(),
  };
}
