import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StateStorage } from 'zustand/middleware';
import { createDebouncedStorage } from '../debouncedStorage';

function createInnerMock() {
  const store = new Map<string, string>();
  const inner: StateStorage = {
    getItem: vi.fn(async (key: string) => store.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      store.delete(key);
    }),
  };
  return { inner, store };
}

describe('createDebouncedStorage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('coalesces rapid writes into one trailing inner write with the last value', async () => {
    const { inner, store } = createInnerMock();
    const storage = createDebouncedStorage(inner, 500);

    await storage.setItem('key', 'one');
    await storage.setItem('key', 'two');
    await storage.setItem('key', 'three');
    expect(inner.setItem).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(500);
    expect(inner.setItem).toHaveBeenCalledTimes(1);
    expect(store.get('key')).toBe('three');
  });

  it('serves pending values from getItem before the flush, inner values after', async () => {
    const { inner } = createInnerMock();
    const storage = createDebouncedStorage(inner, 500);

    await storage.setItem('key', 'pending');
    expect(await storage.getItem('key')).toBe('pending');
    expect(inner.getItem).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(500);
    expect(await storage.getItem('key')).toBe('pending');
    expect(inner.getItem).toHaveBeenCalledTimes(1);
  });

  it('removeItem cancels a pending write and deletes from the inner store', async () => {
    const { inner, store } = createInnerMock();
    const storage = createDebouncedStorage(inner, 500);
    store.set('key', 'old');

    await storage.setItem('key', 'new');
    await storage.removeItem('key');
    await vi.advanceTimersByTimeAsync(500);

    expect(inner.setItem).not.toHaveBeenCalled();
    expect(store.has('key')).toBe(false);
    expect(await storage.getItem('key')).toBeNull();
  });

  it('flush writes all pending entries immediately', async () => {
    const { inner, store } = createInnerMock();
    const storage = createDebouncedStorage(inner, 500);

    await storage.setItem('a', '1');
    await storage.setItem('b', '2');
    await storage.flush();

    expect(store.get('a')).toBe('1');
    expect(store.get('b')).toBe('2');

    // Timers were cancelled — firing them must not double-write.
    await vi.advanceTimersByTimeAsync(500);
    expect(inner.setItem).toHaveBeenCalledTimes(2);
  });

  it('debounces independent keys independently', async () => {
    const { inner, store } = createInnerMock();
    const storage = createDebouncedStorage(inner, 500);

    await storage.setItem('a', '1');
    await vi.advanceTimersByTimeAsync(300);
    await storage.setItem('b', '2');
    await vi.advanceTimersByTimeAsync(200);

    expect(store.get('a')).toBe('1');
    expect(store.has('b')).toBe(false);

    await vi.advanceTimersByTimeAsync(300);
    expect(store.get('b')).toBe('2');
  });

  it('passes writes straight through when delay is zero', async () => {
    const { inner, store } = createInnerMock();
    const storage = createDebouncedStorage(inner, 0);

    await storage.setItem('key', 'value');
    expect(inner.setItem).toHaveBeenCalledTimes(1);
    expect(store.get('key')).toBe('value');
  });
});
