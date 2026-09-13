import type { StateStorage } from 'zustand/middleware';
import { getDb } from './mosaicDb';

/*
 * Zustand `persist` storage over the database's `settings` table. Reads come from a
 * copy taken at boot, so they are synchronous and the stores hydrate before the first
 * paint — no flash of the default theme. Writes update the copy and go to main in
 * order; nothing waits on them.
 */

const settings = new Map<string, string>();

/** Load the settings boot returned. Call before hydrating any store that uses them. */
export function seedSettings(stored: Record<string, string>): void {
  settings.clear();
  for (const [key, value] of Object.entries(stored)) settings.set(key, value);
}

function reportFailure(key: string) {
  return (error: unknown) => console.error(`Could not save the "${key}" setting`, error);
}

/** A setting as boot loaded it, or as it was last written. */
export function readSetting(key: string): string | null {
  return settings.get(key) ?? null;
}

export function writeSetting(key: string, value: string): void {
  if (settings.get(key) === value) return;
  settings.set(key, value);
  getDb().settings.set(key, value).catch(reportFailure(key));
}

export const settingsStorage: StateStorage = {
  getItem: readSetting,
  setItem: writeSetting,
  removeItem: (key) => {
    if (!settings.delete(key)) return;
    getDb().settings.remove(key).catch(reportFailure(key));
  },
};
