import { describe, expect, it, vi } from 'vitest';
import { createReadCache } from '../readCache';

/** A cache of one kind whose results count how often each id was loaded. */
function countingCache(keep: number, load?: (id: string, count: number) => Promise<string>) {
  const counts = new Map<string, number>();
  const loader = vi.fn((id: string) => {
    const count = (counts.get(id) ?? 0) + 1;
    counts.set(id, count);
    return load ? load(id, count) : Promise.resolve(`${id}#${count}`);
  });
  const cache = createReadCache({
    word: { load: loader, keep, staleOn: (id: string) => [{ topic: 'word', id }] },
  });
  return { cache, loader };
}

describe('createReadCache', () => {
  it('serves a second read from the cache, already settled', async () => {
    const { cache, loader } = countingCache(2);

    await expect(cache.read('word', 'a')).resolves.toBe('a#1');
    const again = cache.read('word', 'a');

    expect(again).toMatchObject({ status: 'fulfilled', value: 'a#1' });
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('keeps only the most recently read past its limit', async () => {
    const { cache, loader } = countingCache(2);

    await cache.read('word', 'a');
    await cache.read('word', 'b');
    await cache.read('word', 'a');
    await cache.read('word', 'c');

    await expect(cache.read('word', 'a')).resolves.toBe('a#1');
    await expect(cache.read('word', 'b')).resolves.toBe('b#2');
    expect(loader).toHaveBeenCalledTimes(4);
  });

  it('reads again after a failed read', async () => {
    const { cache } = countingCache(2, (id, count) =>
      count === 1 ? Promise.reject(new Error('busy')) : Promise.resolve(`${id}#${count}`)
    );

    await expect(cache.read('word', 'a')).rejects.toThrow('busy');
    await expect(cache.read('word', 'a')).resolves.toBe('a#2');
  });

  it('reloads only what a change made stale, and says when it swapped it in', async () => {
    const { cache } = countingCache(3);
    await cache.read('word', 'a');
    await cache.read('word', 'b');
    const listener = vi.fn();
    cache.subscribe(listener);

    await cache.markChanged({ topic: 'word', id: 'a' });

    expect(cache.read('word', 'a')).toMatchObject({ status: 'fulfilled', value: 'a#2' });
    await expect(cache.read('word', 'b')).resolves.toBe('b#1');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(cache.getRevision()).toBe(1);
  });

  it('reloads every id under a topic when the change names none', async () => {
    const { cache } = countingCache(3);
    await cache.read('word', 'a');
    await cache.read('word', 'b');

    await cache.markChanged({ topic: 'word' });
    await cache.markChanged({ topic: 'other' });

    await expect(cache.read('word', 'a')).resolves.toBe('a#2');
    await expect(cache.read('word', 'b')).resolves.toBe('b#2');
  });

  it('keeps the newest reload when two finish out of order', async () => {
    const pending: (() => void)[] = [];
    const { cache } = countingCache(1, (id, count) =>
      count === 1
        ? Promise.resolve(`${id}#1`)
        : new Promise((resolve) => pending.push(() => resolve(`${id}#${count}`)))
    );
    await cache.read('word', 'a');

    const first = cache.markChanged({ topic: 'word', id: 'a' });
    const second = cache.markChanged({ topic: 'word', id: 'a' });
    pending[1]();
    pending[0]();
    await Promise.all([first, second]);

    await expect(cache.read('word', 'a')).resolves.toBe('a#3');
  });

  it('drops a result whose reload fails, so the next read tries again', async () => {
    const { cache } = countingCache(1, (id, count) =>
      count === 2 ? Promise.reject(new Error('gone')) : Promise.resolve(`${id}#${count}`)
    );
    await cache.read('word', 'a');

    await cache.markChanged({ topic: 'word', id: 'a' });

    await expect(cache.read('word', 'a')).resolves.toBe('a#3');
  });
});
