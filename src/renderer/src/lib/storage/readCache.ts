/** A change to stored data. Without an `id`, every id under the topic changed. */
export interface Change {
  topic: string;
  id?: string;
}

/** One kind of read: how to load a result, how many to keep, and what makes one stale. */
export interface ReadKind<T> {
  load: (id: string) => Promise<T>;
  /** How many results to keep; the least recently read goes first. */
  keep: number;
  staleOn: (id: string) => Change[];
}

type ResultOf<Kind> = Kind extends ReadKind<infer T> ? T : never;

/**
 * Settled promises say so, the way React's `use()` looks for, so a read already in the
 * cache renders at once instead of suspending for a frame.
 */
type TrackedPromise<T> = Promise<T> & { status?: string; value?: T; reason?: unknown };

function trackPromise<T>(promise: Promise<T>): TrackedPromise<T> {
  const tracked: TrackedPromise<T> = promise;
  tracked.status = 'pending';
  tracked.then(
    (value) => {
      tracked.status = 'fulfilled';
      tracked.value = value;
    },
    (reason: unknown) => {
      tracked.status = 'rejected';
      tracked.reason = reason;
    }
  );
  return tracked;
}

function settledPromise<T>(value: T): TrackedPromise<T> {
  const settled: TrackedPromise<T> = Promise.resolve(value);
  settled.status = 'fulfilled';
  settled.value = value;
  return settled;
}

interface Entry<T> {
  promise: TrackedPromise<T>;
  changes: Change[];
  /** The newest load for this entry; an older one finishing late is ignored. */
  latestLoad: Promise<T>;
}

const isStaleAfter = (changes: Change[], change: Change) =>
  changes.some(
    ({ topic, id }) => topic === change.topic && (change.id === undefined || id === change.id)
  );

/**
 * Keeps the results of reads by kind and id, so asking again returns the same promise.
 * A failed read is dropped, so the next one tries again. `markChanged` reloads the results
 * a change made stale and swaps each in once it is read, so whatever shows them moves
 * straight to the new result rather than back to loading.
 */
export function createReadCache<Kinds extends Record<string, ReadKind<unknown>>>(kinds: Kinds) {
  const entries = new Map<keyof Kinds, Map<string, Entry<unknown>>>(
    Object.keys(kinds).map((name) => [name, new Map()])
  );
  const listeners = new Set<() => void>();
  let revision = 0;

  const announce = () => {
    revision += 1;
    for (const listener of listeners) listener();
  };

  function read<Name extends keyof Kinds>(name: Name, id: string): Promise<ResultOf<Kinds[Name]>> {
    const kept = entries.get(name)!;
    const found = kept.get(id);
    if (found) {
      // A Map iterates in insertion order, so moving it to the end makes it the newest.
      kept.delete(id);
      kept.set(id, found);
      return found.promise as Promise<ResultOf<Kinds[Name]>>;
    }
    const kind = kinds[name];
    const load = kind.load(id);
    const entry: Entry<unknown> = {
      promise: trackPromise(load),
      changes: kind.staleOn(id),
      latestLoad: load,
    };
    load.catch(() => {
      if (kept.get(id) === entry) kept.delete(id);
    });
    kept.set(id, entry);
    for (const oldest of kept.keys()) {
      if (kept.size <= kind.keep) break;
      kept.delete(oldest);
    }
    return entry.promise as Promise<ResultOf<Kinds[Name]>>;
  }

  async function reload(name: keyof Kinds, id: string, entry: Entry<unknown>) {
    const kept = entries.get(name)!;
    const load = kinds[name].load(id);
    entry.latestLoad = load;
    const isLatest = () => kept.get(id) === entry && entry.latestLoad === load;
    try {
      const value = await load;
      if (!isLatest()) return;
      entry.promise = settledPromise(value);
    } catch {
      if (!isLatest()) return;
      kept.delete(id);
    }
    announce();
  }

  /** Reloads every result `change` made stale; resolves once they are read again. */
  async function markChanged(change: Change): Promise<void> {
    const reloads: Promise<void>[] = [];
    for (const [name, kept] of entries) {
      for (const [id, entry] of kept) {
        if (isStaleAfter(entry.changes, change)) reloads.push(reload(name, id, entry));
      }
    }
    await Promise.all(reloads);
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return { read, markChanged, subscribe, getRevision: () => revision };
}
