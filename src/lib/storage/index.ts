import type { StateStorage } from 'zustand/middleware';
import { dexieStorage } from './dexieStorage';

/**
 * IndexedDB (Dexie) storage for the resume and template stores, which have not moved to
 * the database yet. Settings already live there — see `settingsStorage`.
 */
export function getStorage(): StateStorage {
  return dexieStorage;
}
