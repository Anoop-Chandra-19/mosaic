import type { KeyIndexStorage, Keyring } from '../apiKeys';

/** A keychain in memory that records every call and can be told to refuse them. */
export function fakeKeyring() {
  const entries = new Map<string, string>();
  const calls: string[] = [];
  const refusing = new Set<'get' | 'set' | 'delete'>();
  const refuse = (op: 'get' | 'set' | 'delete', account: string) => {
    calls.push(`${op} ${account}`);
    if (refusing.has(op)) throw new Error(`keychain refused ${op}`);
  };
  const keyring: Keyring = {
    get: async (account) => {
      refuse('get', account);
      return entries.get(account) ?? null;
    },
    set: async (account, secret) => {
      refuse('set', account);
      entries.set(account, secret);
    },
    delete: async (account) => {
      refuse('delete', account);
      return entries.delete(account);
    },
  };
  return { keyring, entries, calls, refusing };
}

/** The settings row main keeps its note in. */
export function memoryStorage(): KeyIndexStorage & { value: string | null } {
  const storage = {
    value: null as string | null,
    read: () => storage.value,
    write: (value: string) => {
      storage.value = value;
    },
  };
  return storage;
}
