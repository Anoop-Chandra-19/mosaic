import type { StateStorage } from 'zustand/middleware';

export interface DebouncedStorage extends StateStorage {
  /** Cancel pending timers and write all queued values immediately. */
  flush: () => Promise<void>;
}

/**
 * Wraps a StateStorage so rapid setItem calls coalesce into one trailing
 * write per key. Intended for backends where writes are expensive (e.g. the
 * future Electron file vault) — not enabled for IndexedDB in the browser.
 */
export function createDebouncedStorage(inner: StateStorage, delayMs: number): DebouncedStorage {
  if (delayMs <= 0) {
    return {
      getItem: (key) => inner.getItem(key),
      setItem: (key, value) => inner.setItem(key, value),
      removeItem: (key) => inner.removeItem(key),
      flush: async () => {},
    };
  }

  const pending = new Map<string, string>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  const cancelTimer = (key: string) => {
    const timer = timers.get(key);
    if (timer !== undefined) {
      clearTimeout(timer);
      timers.delete(key);
    }
  };

  const writePending = async (key: string) => {
    const value = pending.get(key);
    if (value === undefined) return;
    pending.delete(key);
    await inner.setItem(key, value);
  };

  return {
    getItem: async (key) => {
      // Read-your-writes: a queued value is the latest truth for this key.
      const queued = pending.get(key);
      if (queued !== undefined) return queued;
      return inner.getItem(key);
    },

    setItem: async (key, value) => {
      pending.set(key, value);
      cancelTimer(key);
      timers.set(
        key,
        setTimeout(() => {
          timers.delete(key);
          void writePending(key);
        }, delayMs)
      );
    },

    removeItem: async (key) => {
      cancelTimer(key);
      pending.delete(key);
      await inner.removeItem(key);
    },

    flush: async () => {
      const keys = [...pending.keys()];
      for (const key of keys) cancelTimer(key);
      await Promise.all(keys.map((key) => writePending(key)));
    },
  };
}

/**
 * Flush queued writes when the page is being hidden or unloaded.
 * Returns a disposer that removes the listeners.
 */
export function attachFlushOnHide(storage: DebouncedStorage): () => void {
  const onPageHide = () => {
    void storage.flush();
  };
  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') void storage.flush();
  };

  window.addEventListener('pagehide', onPageHide);
  document.addEventListener('visibilitychange', onVisibilityChange);

  return () => {
    window.removeEventListener('pagehide', onPageHide);
    document.removeEventListener('visibilitychange', onVisibilityChange);
  };
}
