import type { AIProvider } from '@/types/resume';

export type SecretsStorageMode = 'session' | 'keychain';

export interface SecretsClient {
  getStorageMode: () => SecretsStorageMode;
  getApiKey: (provider: AIProvider) => Promise<string | null>;
  setApiKey: (provider: AIProvider, key: string) => Promise<void>;
  deleteApiKey: (provider: AIProvider) => Promise<void>;
  clearAllApiKeys: () => Promise<void>;
}
