import type { KeyedProvider, SaveKeyOptions } from '@shared/types/secrets';

/*
 * API keys, kept by main: a key goes in and never comes back out. `stores/secretsStore.ts`
 * keeps what these answer about the saved keys, so every screen shows the same; a read that
 * belongs to one screen, like a key's model list, may come straight here.
 */
export const secretsService = {
  status: () => window.mosaic.secrets.status(),
  save: (provider: KeyedProvider, key: string, options: SaveKeyOptions) =>
    window.mosaic.secrets.save(provider, key, options),
  check: (provider: KeyedProvider) => window.mosaic.secrets.check(provider),
  remove: (provider: KeyedProvider) => window.mosaic.secrets.remove(provider),
  forgetAll: () => window.mosaic.secrets.forgetAll(),
  listModels: (provider: KeyedProvider, refresh: boolean) =>
    window.mosaic.secrets.listModels(provider, refresh),
};
