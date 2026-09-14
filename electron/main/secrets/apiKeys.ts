import {
  KEYED_PROVIDERS,
  type KeyedProvider,
  type KeyLocation,
  type SecretsStatus,
} from '@/types/secrets';

/** One OS keychain service, holding an entry per account. */
export interface Keyring {
  get(account: string): Promise<string | null | undefined>;
  set(account: string, secret: string): Promise<void>;
  /** Resolves true if there was an entry to delete. */
  delete(account: string): Promise<boolean>;
}

/** Where main keeps its note of which keys the keychain holds — the settings table. */
export interface KeyIndexStorage {
  read(): string | null;
  write(value: string): void;
}

/** The keychain holds a key but would not hand it over (locked, or the prompt was refused). */
export class KeychainError extends Error {}

/** Main's note between launches. Provider names only, never a key. */
interface KeyIndex {
  /** What the user chose. */
  location: KeyLocation;
  /** Providers whose key is in the keychain. */
  keychain: KeyedProvider[];
}

function parseIndex(value: string | null): KeyIndex {
  try {
    const stored = JSON.parse(value ?? 'null') as Partial<Record<keyof KeyIndex, unknown>> | null;
    const listed = Array.isArray(stored?.keychain) ? (stored.keychain as unknown[]) : [];
    return {
      location: stored?.location === 'session' ? 'session' : 'keychain',
      keychain: KEYED_PROVIDERS.filter((provider) => listed.includes(provider)),
    };
  } catch {
    return { location: 'keychain', keychain: [] };
  }
}

function withKeychainEntry(index: KeyIndex, provider: KeyedProvider, held: boolean): KeyIndex {
  const others = index.keychain.filter((p) => p !== provider);
  return {
    ...index,
    keychain: KEYED_PROVIDERS.filter((p) => others.includes(p) || (held && p === provider)),
  };
}

export interface ApiKeys {
  status(): Promise<SecretsStatus>;
  save(provider: KeyedProvider, key: string): Promise<SecretsStatus>;
  remove(provider: KeyedProvider): Promise<SecretsStatus>;
  setLocation(location: KeyLocation): Promise<SecretsStatus>;
  forgetAll(): Promise<SecretsStatus>;
  /**
   * The saved key, for main's own calls (Test now, the assistant later). Never sent to the
   * renderer. Rejects with `KeychainError` if the keychain holds it but won't give it back.
   */
  read(provider: KeyedProvider): Promise<string | undefined>;
}

/**
 * API keys, kept by main: in the OS keychain, or in memory for this session. The keychain
 * is only touched when a key is saved, read, moved, or removed — never to report status —
 * so opening Settings cannot raise a keychain prompt. A keychain that refuses a write is
 * marked unavailable until the next launch, and keys stay in memory instead.
 */
export function createApiKeys(keyring: Keyring, storage: KeyIndexStorage): ApiKeys {
  const session = new Map<KeyedProvider, string>();
  let keychain: SecretsStatus['keychain'] = 'unknown';

  // One change at a time: moving keys between the two places takes several keychain calls,
  // and a save arriving halfway must not see a half-moved state.
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.then(task, task);
    queue = run.catch(() => {});
    return run;
  };

  const load = () => parseIndex(storage.read());
  const store = (index: KeyIndex) => storage.write(JSON.stringify(index));

  const snapshot = (): SecretsStatus => {
    const index = load();
    const saved: SecretsStatus['saved'] = {};
    for (const provider of index.keychain) saved[provider] = 'keychain';
    // A session key is the one in use, even if an older copy is still in the keychain.
    for (const provider of session.keys()) saved[provider] = 'session';
    return {
      location:
        index.location === 'keychain' && keychain !== 'unavailable' ? 'keychain' : 'session',
      keychain,
      saved,
    };
  };

  /** False, and the keychain marked unavailable, if it refuses the key. */
  const writeKeychain = async (provider: KeyedProvider, key: string): Promise<boolean> => {
    try {
      await keyring.set(provider, key);
      keychain = 'available';
      return true;
    } catch (error) {
      console.warn(`The keychain refused a key; keeping keys for this session. ${String(error)}`);
      keychain = 'unavailable';
      return false;
    }
  };

  /** Deletes the keychain's copy and the note of it. */
  const dropFromKeychain = async (index: KeyIndex, provider: KeyedProvider): Promise<KeyIndex> => {
    await keyring.delete(provider);
    const next = withKeychainEntry(index, provider, false);
    store(next);
    return next;
  };

  return {
    status: () => serial(async () => snapshot()),

    save: (provider, key) =>
      serial(async () => {
        const index = load();
        const toKeychain = index.location === 'keychain' && keychain !== 'unavailable';
        if (toKeychain && (await writeKeychain(provider, key))) {
          session.delete(provider);
          store(withKeychainEntry(index, provider, true));
          return snapshot();
        }
        session.set(provider, key);
        // The old keychain copy would otherwise come back after a relaunch. If the keychain
        // won't delete it, the session key is still the one used, and Remove or Forget
        // tries again.
        if (index.keychain.includes(provider)) {
          await dropFromKeychain(index, provider).catch(() => {});
        }
        return snapshot();
      }),

    remove: (provider) =>
      serial(async () => {
        session.delete(provider);
        const index = load();
        if (index.keychain.includes(provider)) await dropFromKeychain(index, provider);
        return snapshot();
      }),

    setLocation: (location) =>
      serial(async () => {
        let index = load();
        if (location === 'session') {
          // Read every key before deleting any, so a refusal leaves everything where it was.
          const moving = new Map<KeyedProvider, string>();
          for (const provider of index.keychain) {
            const key = await keyring.get(provider);
            if (key) moving.set(provider, key);
          }
          for (const [provider, key] of moving) {
            if (!session.has(provider)) session.set(provider, key);
          }
          for (const provider of index.keychain) index = await dropFromKeychain(index, provider);
          store({ ...index, location });
          return snapshot();
        }

        index = { ...index, location };
        store(index);
        for (const [provider, key] of session) {
          if (!(await writeKeychain(provider, key))) break;
          session.delete(provider);
          index = withKeychainEntry(index, provider, true);
          store(index);
        }
        return snapshot();
      }),

    forgetAll: () =>
      serial(async () => {
        session.clear();
        let index = load();
        for (const provider of KEYED_PROVIDERS) {
          if (index.keychain.includes(provider)) {
            index = await dropFromKeychain(index, provider);
          } else {
            // Not on record, but gone all the same: an entry left by an earlier install, or
            // a note lost with the database. Only a key on record must be confirmed gone.
            await keyring.delete(provider).catch(() => false);
          }
        }
        return snapshot();
      }),

    read: (provider) =>
      serial(async () => {
        const inSession = session.get(provider);
        if (inSession !== undefined) return inSession;
        const index = load();
        if (!index.keychain.includes(provider)) return undefined;
        let key: string | null | undefined;
        try {
          key = await keyring.get(provider);
        } catch (error) {
          throw new KeychainError(`The keychain would not give back the ${provider} key`, {
            cause: error,
          });
        }
        if (!key) {
          // Deleted outside Mosaic (a keychain manager, say): stop listing it.
          store(withKeychainEntry(index, provider, false));
          return undefined;
        }
        keychain = 'available';
        return key;
      }),
  };
}
