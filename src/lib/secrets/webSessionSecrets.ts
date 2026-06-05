import type { SecretsClient } from './types';

// Module-scoped storage survives component remounts but clears on page reload.
const apiKeys = new Map<string, string>();

export const webSessionSecrets: SecretsClient = {
  getStorageMode: () => 'session',
  getApiKey: async (provider) => apiKeys.get(provider) ?? null,
  setApiKey: async (provider, key) => {
    apiKeys.set(provider, key);
  },
  deleteApiKey: async (provider) => {
    apiKeys.delete(provider);
  },
  clearAllApiKeys: async () => {
    apiKeys.clear();
  },
};
