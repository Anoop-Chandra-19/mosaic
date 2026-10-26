import type { ModelProviderId } from './modelProviders';

/** Providers that take an API key. Ollama runs on this machine and has none. */
export const KEYED_PROVIDERS = [
  'openai',
  'anthropic',
  'gemini',
  'openrouter',
] as const satisfies readonly ModelProviderId[];

export type KeyedProvider = (typeof KEYED_PROVIDERS)[number];

export function isKeyedProvider(provider: ModelProviderId): provider is KeyedProvider {
  return (KEYED_PROVIDERS as readonly ModelProviderId[]).includes(provider);
}

/** Longer than any provider's keys; this only stops a runaway paste. */
export const MAX_KEY_LENGTH = 4096;

/**
 * Where a saved key lives: the OS keychain (Keychain, Credential Manager, the Secret
 * Service), or main's memory until Mosaic quits. Never the database, never a file.
 */
export type KeyLocation = 'keychain' | 'session';

/** A saved key, as facts: where it is, when it was saved, and when it last passed a check. */
export interface SavedKey {
  where: KeyLocation;
  /** Milliseconds since the epoch. */
  savedAt: number;
  /** Null: saved without checking, and not checked since. */
  checkedAt: number | null;
}

export interface SecretsStatus {
  /** Whether this machine has a keychain Mosaic can use — learned the first time it writes one. */
  keychain: 'unknown' | 'available' | 'unavailable';
  saved: Partial<Record<KeyedProvider, SavedKey>>;
}

export interface SaveKeyOptions {
  /** The model in settings, which the check looks up where the provider can. */
  model: string;
  /** False only for "Save without checking", after the provider couldn't be reached. */
  check: boolean;
  /** Kept in memory only, never in the keychain, and gone when Mosaic closes. */
  forgetOnClose: boolean;
}

/** What a check found, and the keys as they stand after it. Nothing in it echoes the key. */
export type KeyCheck =
  | {
      ok: true;
      status: SecretsStatus;
      /** Whether the key can reach the model; null if the provider can't say, or unchecked. */
      modelFound: boolean | null;
    }
  | {
      ok: false;
      /**
       * `refused`: the provider turned the key down. `unreachable`: no answer (offline, or
       * timed out). `failed`: any other error, with its HTTP status. Only checking a saved
       * key: `no-key`, nothing saved; `keychain`, the keychain would not give the key back.
       */
      reason: 'refused' | 'unreachable' | 'failed' | 'no-key' | 'keychain';
      httpStatus?: number;
    };

/** The chat models a key can use, as the provider listed them. */
export interface ModelList {
  /** Newest first, where the provider dates them. */
  models: string[];
  /** Models listed but left out: embeddings, speech, images, or (OpenRouter) no tool calls. */
  hiddenCount: number;
  /** When the provider was asked, in milliseconds since the epoch. */
  listedAt: number;
}

export type ModelListing =
  | { ok: true; list: ModelList }
  | { ok: false; reason: Extract<KeyCheck, { ok: false }>['reason']; httpStatus?: number };

/**
 * `window.mosaic.secrets`: API keys, kept by main. A key goes in and never comes back out —
 * main makes every call that needs one.
 */
export interface MosaicSecrets {
  /** Answers without touching the keychain, so opening Settings never raises a prompt. */
  status(): Promise<SecretsStatus>;
  /**
   * Checks the key with the provider, and keeps it only if the check passes; a key already
   * saved stays until then. Kept in the keychain, or for the session if asked to forget it
   * or if the keychain refuses it.
   */
  save(provider: KeyedProvider, key: string, options: SaveKeyOptions): Promise<KeyCheck>;
  /** Checks the saved key again, for a key saved without checking. */
  check(provider: KeyedProvider, model: string): Promise<KeyCheck>;
  /**
   * The chat models the saved key can use. A check lists them too, and main keeps the last
   * list for each key until Mosaic closes; `refresh` asks the provider again.
   */
  listModels(provider: KeyedProvider, refresh: boolean): Promise<ModelListing>;
  remove(provider: KeyedProvider): Promise<SecretsStatus>;
  /** Every key, from both places. */
  forgetAll(): Promise<SecretsStatus>;
}
