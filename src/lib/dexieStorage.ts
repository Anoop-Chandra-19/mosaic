import type { StateStorage } from 'zustand/middleware';
import { db } from './db';

export const dexieStorage: StateStorage = {
  getItem: async (key) => {
    const entry = await db.kvStore.get(key);
    return entry?.value ?? null;
  },
  setItem: async (key, value) => {
    await db.kvStore.put({ key, value });
  },
  removeItem: async (key) => {
    await db.kvStore.delete(key);
  },
};
