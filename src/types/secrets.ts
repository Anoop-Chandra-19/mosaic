import type { AIProvider } from '@/types/resume';

/** Providers that take an API key. Ollama runs on this machine and has none. */
export const KEYED_PROVIDERS = [
  'openai',
  'anthropic',
  'gemini',
  'openrouter',
] as const satisfies readonly AIProvider[];

export type KeyedProvider = (typeof KEYED_PROVIDERS)[number];

export function isKeyedProvider(provider: AIProvider): provider is KeyedProvider {
  return (KEYED_PROVIDERS as readonly AIProvider[]).includes(provider);
}

/** Longer than any provider's keys; this only stops a runaway paste. */
export const MAX_KEY_LENGTH = 4096;

/**
 * Where a saved key lives: the OS keychain (Keychain, Credential Manager, the Secret
 * Service), or main's memory until Mosaic quits. Never the database, never a file.
 */
export type KeyLocation = 'keychain' | 'session';

export interface SecretsStatus {
  /** Where a key saved now goes. The session when the keychain is unavailable. */
  location: KeyLocation;
  /** Whether this machine has a keychain Mosaic can use — learned the first time it writes one. */
  keychain: 'unknown' | 'available' | 'unavailable';
  /** The providers with a saved key, and where each one is kept. */
  saved: Partial<Record<KeyedProvider, KeyLocation>>;
}

/** What one Test found. Nothing in it echoes the key. */
export type KeyTest =
  | {
      ok: true;
      /** Whether the key can reach the model named in settings; null if the provider can't say. */
      modelFound: boolean | null;
    }
  | {
      ok: false;
      /**
       * `refused`: the provider turned the key down. `unreachable`: no answer (offline, or
       * timed out). `no-key`: nothing saved. `keychain`: the keychain would not give the key
       * back. `failed`: any other error, with its HTTP status.
       */
      reason: 'refused' | 'unreachable' | 'no-key' | 'keychain' | 'failed';
      httpStatus?: number;
    };

/**
 * `window.mosaic.secrets`: API keys, kept by main. A key goes in and never comes back out —
 * main makes every call that needs one.
 */
export interface MosaicSecrets {
  /** Answers without touching the keychain, so opening Settings never raises a prompt. */
  status(): Promise<SecretsStatus>;
  /** Keeps the key where `location` says, or for the session if the keychain refuses it. */
  save(provider: KeyedProvider, key: string): Promise<SecretsStatus>;
  remove(provider: KeyedProvider): Promise<SecretsStatus>;
  /** Moves every saved key there too. Keys stay in the session if the keychain refuses them. */
  setLocation(location: KeyLocation): Promise<SecretsStatus>;
  /** Every key, from both places. */
  forgetAll(): Promise<SecretsStatus>;
  /** Checks a key with the provider: `key` if given, otherwise the saved one. */
  test(provider: KeyedProvider, model: string, key?: string): Promise<KeyTest>;
}
