import Dexie, { type EntityTable } from 'dexie';

interface KVEntry {
  key: string;
  value: string;
}

const db = new Dexie('mosaic') as Dexie & {
  kvStore: EntityTable<KVEntry, 'key'>;
};

db.version(1).stores({
  kvStore: 'key',
});

export { db };
