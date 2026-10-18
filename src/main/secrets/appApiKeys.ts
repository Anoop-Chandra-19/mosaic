import { app } from 'electron';
import { getAppDatabase } from '../db/appDatabase';
import { API_KEYS_KEY, getSetting, setSetting } from '../db/settings';
import { createApiKeys, type ApiKeys } from './apiKeys';
import { KEYCHAIN_SERVICE, osKeyring } from './osKeyring';

/** The app's keys: in this build's keychain service, with main's note of them in settings. */
export function createAppApiKeys(): ApiKeys {
  const service = app.isPackaged ? KEYCHAIN_SERVICE.installed : KEYCHAIN_SERVICE.dev;
  return createApiKeys(osKeyring(service), {
    read: () => {
      const db = getAppDatabase();
      return db ? getSetting(db, API_KEYS_KEY) : null;
    },
    write: (value) => {
      const db = getAppDatabase();
      if (db) setSetting(db, API_KEYS_KEY, value);
    },
  });
}
