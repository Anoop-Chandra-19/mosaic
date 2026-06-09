import type { StateStorage } from 'zustand/middleware';
import { dexieStorage } from '@/lib/dexieStorage';

/**
 * Storage backend for all persisted zustand stores. Stores must import this
 * instead of a concrete adapter so the backend can be swapped per platform.
 *
 * Browser: IndexedDB via Dexie. Writes are cheap, so no debouncing — a
 * debounced flush on pagehide cannot reliably await IndexedDB completion.
 *
 * Electron (future): return a file-backed adapter from the preload bridge
 * (window.mosaic.storage, mirroring the window.mosaic.secrets pattern),
 * wrapped in createDebouncedStorage so per-keystroke persists don't hammer
 * the disk.
 */
export function getStorage(): StateStorage {
  return dexieStorage;
}
