import type { Database } from 'better-sqlite3';
import type { ResumeData } from '@shared/types/resume';
import { StorageError } from './storageError';
import { encodeStoredResume, hashStoredResume, parseAndMigrateStoredResume } from './storedResume';

/** Stores the resume if no version holds it yet; gives its hash either way. */
export function storeDoc(db: Database, doc: ResumeData): string {
  const text = encodeStoredResume(doc);
  const hash = hashStoredResume(text);
  db.prepare('insert into docs (hash, doc) values (?, ?) on conflict (hash) do nothing').run(
    hash,
    text
  );
  return hash;
}

export function hashDoc(doc: ResumeData): string {
  return hashStoredResume(encodeStoredResume(doc));
}

export function readDoc(db: Database, hash: string): ResumeData {
  const row = db
    .prepare<[string], { doc: string }>('select doc from docs where hash = ?')
    .get(hash);
  if (!row) throw new StorageError('not-found', `No document with hash ${hash}`);
  return parseAndMigrateStoredResume(row.doc);
}

/** Documents no version points at any more, after a template is deleted or replaced. */
export function deleteUnusedDocs(db: Database): void {
  db.prepare(
    'delete from docs where not exists (select 1 from versions where versions.doc_hash = docs.hash)'
  ).run();
}
