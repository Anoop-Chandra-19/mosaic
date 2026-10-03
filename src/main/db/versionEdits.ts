import type { Database } from 'better-sqlite3';
import type { Version, VersionMeta } from '@shared/types/db';
import { deleteUnusedDocs } from './docs';
import { StorageError } from './storageError';
import { getVersion, getVersionMeta, headVersion, insertVersion } from './versions';

/*
 * Naming and deleting versions after the fact. A version's number never changes, so
 * deleting v7 leaves v6 and v8 as they were.
 */

/** Names any version, which keeps it for good; renaming a named one is the same call. */
export function renameVersion(db: Database, versionId: string, name: string): VersionMeta {
  return db.transaction(() => {
    const version = getVersionMeta(db, versionId);
    db.prepare(`update versions set kind = 'named', summary = ? where id = ?`).run(name, versionId);
    return { ...version, kind: 'named' as const, summary: name };
  })();
}

interface RemovedVersion {
  version: Version;
  /** The versions that named it as their parent, linked to its parent instead. */
  childIds: string[];
}

/**
 * What was deleted since the app started, for Undo. Kept in memory only: the toast that
 * offers Undo is gone long before the app is.
 */
const removedByDb = new WeakMap<Database, Map<string, RemovedVersion>>();
const MAX_REMEMBERED = 50;

function rememberRemoved(db: Database, removed: RemovedVersion): void {
  let removedHere = removedByDb.get(db);
  if (!removedHere) {
    removedHere = new Map();
    removedByDb.set(db, removedHere);
  }
  removedHere.set(removed.version.id, removed);
  if (removedHere.size > MAX_REMEMBERED) {
    removedHere.delete(removedHere.keys().next().value!);
  }
}

/** Deletes a version other than the newest; its children link to its parent instead. */
export function removeVersion(db: Database, versionId: string): void {
  const removed = db.transaction(() => {
    const version = getVersion(db, versionId);
    if (headVersion(db, version.templateId)?.id === versionId) {
      throw new StorageError(
        'invalid-argument',
        'The newest version can’t be deleted. The draft is measured from it.'
      );
    }
    const childIds = db
      .prepare<[string], { id: string }>('select id from versions where parent_id = ?')
      .all(versionId)
      .map(({ id }) => id);
    db.prepare('update versions set parent_id = ? where parent_id = ?').run(
      version.parentId,
      versionId
    );
    db.prepare('delete from versions where id = ?').run(versionId);
    deleteUnusedDocs(db);
    return { version, childIds };
  })();
  rememberRemoved(db, removed);
}

function versionExists(db: Database, versionId: string): boolean {
  return db.prepare('select 1 from versions where id = ?').get(versionId) !== undefined;
}

/** Its parent, or, when that was deleted too, the nearest version before it still there. */
function findSurvivingParent(db: Database, parentId: string | null): string | null {
  let id = parentId;
  while (id !== null && !versionExists(db, id)) {
    id = removedByDb.get(db)?.get(id)?.version.parentId ?? null;
  }
  return id;
}

/** Undoes a `removeVersion` from this session, with the same id, number and place. */
export function putBackVersion(db: Database, versionId: string): VersionMeta {
  const removed = removedByDb.get(db)?.get(versionId);
  if (!removed) throw new StorageError('not-found', `Version ${versionId} can't be put back`);
  const { version, childIds } = removed;
  const meta = db.transaction(() => {
    const hasTemplate = db.prepare('select 1 from templates where id = ?').get(version.templateId);
    if (!hasTemplate) {
      throw new StorageError('not-found', `No template with id ${version.templateId}`);
    }
    const putBack = insertVersion(db, {
      ...version,
      parentId: findSurvivingParent(db, version.parentId),
    });
    const relink = db.prepare('update versions set parent_id = ? where id = ? and parent_id is ?');
    for (const childId of childIds) relink.run(versionId, childId, version.parentId);
    return putBack;
  })();
  removedByDb.get(db)?.delete(versionId);
  return meta;
}
