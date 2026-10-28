import {
  KEYED_PROVIDERS,
  type KeyedProvider,
  type SavedKey,
  type SecretsStatus,
} from '@shared/types/secrets';

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

type KeyDates = Omit<SavedKey, 'where'>;

/** Main's note between launches: the keychain's keys and their dates, never a key. */
interface KeyIndex {
  keychain: Partial<Record<KeyedProvider, KeyDates>>;
}

function parseDates(value: unknown): KeyDates | undefined {
  const dates = value as Partial<Record<keyof KeyDates, unknown>> | null;
  if (typeof dates?.savedAt !== 'number') return undefined;
  return {
    savedAt: dates.savedAt,
    checkedAt: typeof dates.checkedAt === 'number' ? dates.checkedAt : null,
  };
}

function parseIndex(value: string | null): KeyIndex {
  try {
    const stored = JSON.parse(value ?? 'null') as { keychain?: Record<string, unknown> } | null;
    const keychain: KeyIndex['keychain'] = {};
    for (const provider of KEYED_PROVIDERS) {
      const dates = parseDates(stored?.keychain?.[provider]);
      if (dates) keychain[provider] = dates;
    }
    return { keychain };
  } catch {
    return { keychain: {} };
  }
}

function withKeychainEntry(
  index: KeyIndex,
  provider: KeyedProvider,
  dates: KeyDates | undefined
): KeyIndex {
  const keychain = { ...index.keychain };
  if (dates) keychain[provider] = dates;
  else delete keychain[provider];
  return { keychain };
}

export interface SaveOptions {
  /** Kept in memory only, never written to the keychain. */
  forgetOnClose: boolean;
  /** Whether it passed a check just now; false when saved without checking. */
  checked: boolean;
}

export interface ApiKeys {
  status(): Promise<SecretsStatus>;
  save(provider: KeyedProvider, key: string, options: SaveOptions): Promise<SecretsStatus>;
  /** Notes that the key saved at `savedAt` passed a check; a key saved since is left alone. */
  markChecked(provider: KeyedProvider, savedAt: number): Promise<SecretsStatus>;
  remove(provider: KeyedProvider): Promise<SecretsStatus>;
  forgetAll(): Promise<SecretsStatus>;
  /**
   * Refuses saves, checks and removals until the returned release is called, so a key saved
   * during Erase can't outlive it. Forgetting still runs. Throws if already held: one erase
   * at a time.
   */
  holdChanges(): () => void;
  /**
   * The saved key, for main's own calls (checks and the assistant's runs). Never sent to the
   * renderer. Rejects with `KeychainError` if the keychain holds it but won't give it back.
   */
  read(provider: KeyedProvider): Promise<string | undefined>;
}

/**
 * API keys, kept by main: in the OS keychain, or in memory for this session when asked to
 * forget the key on close. The keychain is only touched when a key is saved, read, or
 * removed — never to report status — so opening Settings cannot raise a keychain prompt. A
 * keychain that refuses a write is marked unavailable until the next launch, and keys stay in
 * memory instead.
 */
export function createApiKeys(
  keyring: Keyring,
  storage: KeyIndexStorage,
  now: () => number = Date.now
): ApiKeys {
  const session = new Map<KeyedProvider, KeyDates & { key: string }>();
  let keychain: SecretsStatus['keychain'] = 'unknown';

  // One change at a time: forgetting every key takes several keychain calls, and a save
  // arriving halfway must not see a half-done state.
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.then(task, task);
    queue = run.catch(() => {});
    return run;
  };

  // Checked when the change runs, not when it's asked for: one queued before the hold, or
  // a save whose key check was still out with the provider, lands after Erase has begun.
  let isHeld = false;
  const change = <T>(task: () => Promise<T>): Promise<T> =>
    serial(async () => {
      if (isHeld) throw new Error('Key changes wait until Erase everything finishes');
      return task();
    });

  const load = () => parseIndex(storage.read());
  const store = (index: KeyIndex) => storage.write(JSON.stringify(index));

  const snapshot = (): SecretsStatus => {
    const saved: SecretsStatus['saved'] = {};
    for (const [provider, dates] of Object.entries(load().keychain)) {
      saved[provider as KeyedProvider] = { where: 'keychain', ...dates };
    }
    // A session key is the one in use, even if an older copy is still in the keychain.
    for (const [provider, { savedAt, checkedAt }] of session) {
      saved[provider] = { where: 'session', savedAt, checkedAt };
    }
    return { keychain, saved };
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
    const next = withKeychainEntry(index, provider, undefined);
    store(next);
    return next;
  };

  return {
    status: () => serial(async () => snapshot()),

    save: (provider, key, { forgetOnClose, checked }) =>
      change(async () => {
        const index = load();
        const savedAt = now();
        const dates: KeyDates = { savedAt, checkedAt: checked ? savedAt : null };
        const toKeychain = !forgetOnClose && keychain !== 'unavailable';
        if (toKeychain && (await writeKeychain(provider, key))) {
          session.delete(provider);
          store(withKeychainEntry(index, provider, dates));
          return snapshot();
        }
        session.set(provider, { key, ...dates });
        // The old keychain copy would otherwise come back after a relaunch. If the keychain
        // won't delete it, the session key is still the one used, and Remove or Forget
        // tries again.
        if (index.keychain[provider]) {
          await dropFromKeychain(index, provider).catch(() => {});
        }
        return snapshot();
      }),

    markChecked: (provider, savedAt) =>
      change(async () => {
        const checkedAt = now();
        const inSession = session.get(provider);
        if (inSession) {
          if (inSession.savedAt === savedAt) session.set(provider, { ...inSession, checkedAt });
          return snapshot();
        }
        const index = load();
        if (index.keychain[provider]?.savedAt === savedAt) {
          store(withKeychainEntry(index, provider, { savedAt, checkedAt }));
        }
        return snapshot();
      }),

    remove: (provider) =>
      change(async () => {
        session.delete(provider);
        const index = load();
        if (index.keychain[provider]) await dropFromKeychain(index, provider);
        return snapshot();
      }),

    forgetAll: () =>
      serial(async () => {
        session.clear();
        let index = load();
        for (const provider of KEYED_PROVIDERS) {
          if (index.keychain[provider]) {
            index = await dropFromKeychain(index, provider);
          } else {
            // Not on record, but gone all the same: an entry left by an earlier install, or
            // a note lost with the database. Only a key on record must be confirmed gone.
            await keyring.delete(provider).catch(() => false);
          }
        }
        return snapshot();
      }),

    holdChanges: () => {
      if (isHeld) throw new Error('Erase everything is already running');
      isHeld = true;
      return () => {
        isHeld = false;
      };
    },

    read: (provider) =>
      serial(async () => {
        const inSession = session.get(provider);
        if (inSession !== undefined) return inSession.key;
        const index = load();
        if (!index.keychain[provider]) return undefined;
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
          store(withKeychainEntry(index, provider, undefined));
          return undefined;
        }
        keychain = 'available';
        return key;
      }),
  };
}
