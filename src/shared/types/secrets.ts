import type { ModelProviderId } from './modelProviders';

/** Providers that take an API key. Ollama runs on this machine and has none. */
export const KEYED_PROVIDERS = [
  'openai',
  'anthropic',
  'google',
  'openrouter',
] as const satisfies readonly ModelProviderId[];

export type KeyedProvider = (typeof KEYED_PROVIDERS)[number];

export function isKeyedProvider(provider: ModelProviderId): provider is KeyedProvider {
  return (KEYED_PROVIDERS as readonly ModelProviderId[]).includes(provider);
}

/** Exceeds provider key lengths; guards against oversized pastes. */
export const MAX_KEY_LENGTH = 4096;

/**
 * Keys are stored in the OS keychain (Keychain, Credential Manager, or Secret Service),
 * or in main's memory until Mosaic quits. Never in the database or a file.
 */
export type KeyLocation = 'keychain' | 'session';

/** Saved key metadata: storage location, save time, and last successful check. */
export interface SavedKey {
  where: KeyLocation;
  /** Milliseconds since the epoch. */
  savedAt: number;
  /** Null if saved without checking and not checked since. */
  checkedAt: number | null;
  /** Records a provider refusal during a run; cleared when a check passes or a run finishes. */
  refusedAt?: number;
}

export interface SecretsStatus {
  /** Keychain availability, determined on the first attempt to write a key. */
  keychain: 'unknown' | 'available' | 'unavailable';
  saved: Partial<Record<KeyedProvider, SavedKey>>;
}

export interface SaveKeyOptions {
  /** False only for "Save without checking", after the provider couldn't be reached. */
  check: boolean;
  /** Kept in memory only, never in the keychain, and gone when Mosaic closes. */
  forgetOnClose: boolean;
}

/** Check result and updated key status. Never includes the key itself. */
export type KeyCheck =
  | { ok: true; status: SecretsStatus }
  | {
      ok: false;
      /**
       * `refused`: the provider rejected the key. `unreachable`: no response (offline or
       * timed out). `failed`: any other error, with its HTTP status. When checking a saved
       * key only: `no-key` means none is saved; `keychain` means the keychain denied access.
       */
      reason: 'refused' | 'unreachable' | 'failed' | 'no-key' | 'keychain';
      httpStatus?: number;
    };

/** Result of deleting all keys. */
export interface ForgetResult {
  status: SecretsStatus;
  /**
   * Unrecorded keychain entries that could not be deleted and may still exist, left by
   * an earlier install or a database that has since been erased.
   */
  unconfirmed: KeyedProvider[];
}

/** Keys whose deletion "Erase everything" could not confirm; other data is deleted as files. */
export interface EraseResult {
  unconfirmedKeys: KeyedProvider[];
}

/** The chat models a key can use, as the provider listed them. */
export interface ModelList {
  /** Newest first when the provider supplies model dates. */
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
 * `window.mosaic.secrets`: API keys managed by main. The renderer can submit keys but
 * never read them back; main makes every call that needs a key.
 */
export interface MosaicSecrets {
  /** Returns status without accessing the keychain, so opening Settings never triggers a prompt. */
  status(): Promise<SecretsStatus>;
  /**
   * Checks the key with the provider and saves it only if the check passes; an existing
   * key is preserved until then. Stores it in the keychain, or in memory for the session
   * if forget-on-close is requested or the keychain refuses it.
   */
  save(provider: KeyedProvider, key: string, options: SaveKeyOptions): Promise<KeyCheck>;
  /** Checks a saved key, including one saved without checking. */
  check(provider: KeyedProvider): Promise<KeyCheck>;
  /**
   * Lists chat models available to the saved key. Checks also fetch this list. Main caches
   * the last list for each key until Mosaic closes; `refresh` queries the provider again.
   */
  listModels(provider: KeyedProvider, refresh: boolean): Promise<ModelListing>;
  remove(provider: KeyedProvider): Promise<SecretsStatus>;
  /** Deletes all keys from both the keychain and session memory. */
  forgetAll(): Promise<ForgetResult>;
}
