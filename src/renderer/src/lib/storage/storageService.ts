import { use, useSyncExternalStore } from 'react';
import type { ImportMode } from '@shared/types/bundle';
import type { AppliedHistory, NamingMode, SnapshotOccasion, VersionMeta } from '@shared/types/db';
import type { ResumeData } from '@shared/types/resume';
import { getDb } from './mosaicDb';
import { createReadCache, type Change } from './readCache';

/*
 * The storage service: everything stores read and write, by what it is (`storage.versions
 * .get`), never how. Reads may come from the cache (`readCache.ts`) or main; writes go to
 * main and then read again whatever they made stale. Stores are the only users, through
 * `storage` and `useStored`; `getDb()` (`mosaicDb.ts`) and the cache stay in here.
 */

/** What a write changed, matched against what each kept read names. No id: every one. */
const changed = {
  version: (versionId?: string): Change => ({ topic: 'version', id: versionId }),
  history: (templateId?: string): Change => ({ topic: 'history', id: templateId }),
  draft: (templateId?: string): Change => ({ topic: 'draft', id: templateId }),
};

const cache = createReadCache({
  /** A version never changes but for its name, so the full history and preview share it. */
  version: {
    load: (versionId) => getDb().versions.get(versionId),
    keep: 30,
    staleOn: (versionId) => [changed.version(versionId)],
  },
  versionList: {
    load: (templateId) => getDb().versions.list(templateId),
    keep: 20,
    staleOn: (templateId) => [changed.history(templateId)],
  },
  draft: {
    load: (templateId) => getDb().drafts.get(templateId),
    keep: 5,
    staleOn: (templateId) => [changed.draft(templateId)],
  },
});

/** Runs a write, then reads again what it changed, worked out from what it returned. */
async function writeAndRefresh<T>(write: Promise<T>, changes: (result: T) => Change[]) {
  const result = await write;
  await Promise.all(changes(result).map(cache.markChanged));
  return result;
}

/** A new version, or the newest renamed: naming a draft it already holds renames it. */
const versionWritten = (version: VersionMeta) => [
  changed.version(version.id),
  changed.history(version.templateId),
];

/** Rejects with a `DbError` when main refuses. Writes that touch nothing kept go straight to main. */
export const storage = {
  templates: {
    /** Summaries, read every time: stores keep them as state. */
    list: () => getDb().templates.list(),
    create: (name: string, doc: ResumeData, importedFrom?: string) =>
      getDb().templates.create(name, doc, importedFrom),
    /** Loads its draft and remembers it for the next launch. */
    open: (templateId: string) => getDb().templates.open(templateId),
    rename: (templateId: string, name: string) => getDb().templates.rename(templateId, name),
    duplicate: (templateId: string) => getDb().templates.duplicate(templateId),
    remove: (templateId: string) =>
      writeAndRefresh(getDb().templates.remove(templateId), () => [
        changed.history(templateId),
        changed.draft(templateId),
      ]),
  },

  drafts: {
    /** Another template's stored draft. The open template's is the editor's. */
    get: (templateId: string) => cache.read('draft', templateId),
    save: (templateId: string, doc: ResumeData, rev: number) =>
      writeAndRefresh(getDb().drafts.save(templateId, doc, rev), () => [changed.draft(templateId)]),
    importInto: (templateId: string, doc: ResumeData, from: string, isRecorded: boolean) =>
      writeAndRefresh(getDb().drafts.importInto(templateId, doc, from, isRecorded), () => [
        changed.draft(templateId),
        changed.history(templateId),
      ]),
  },

  versions: {
    get: (versionId: string) => cache.read('version', versionId),
    /** A template's history, newest first, without documents. */
    list: (templateId: string) => cache.read('versionList', templateId),
    name: (templateId: string, name: string, mode: NamingMode) =>
      writeAndRefresh(getDb().versions.name(templateId, name, mode), versionWritten),
    snapshot: (templateId: string, occasion: SnapshotOccasion) =>
      writeAndRefresh(getDb().versions.snapshot(templateId, occasion), versionWritten),
    /** After the assistant's suggestions: `summary` says what landed. */
    snapshotApplied: (templateId: string, summary: string, history: AppliedHistory) =>
      writeAndRefresh(
        getDb().versions.snapshotApplied(templateId, summary, history),
        versionWritten
      ),
    restore: (templateId: string, versionId: string, shouldKeepDraft: boolean) =>
      writeAndRefresh(getDb().versions.restore(templateId, versionId, shouldKeepDraft), () => [
        changed.draft(templateId),
        changed.history(templateId),
      ]),
    duplicate: (versionId: string) => getDb().versions.duplicate(versionId),
    rename: (versionId: string, name: string) =>
      writeAndRefresh(getDb().versions.rename(versionId, name), versionWritten),
    /** Its children name its parent as theirs now, so every kept version is read again. */
    remove: (version: VersionMeta) =>
      writeAndRefresh(getDb().versions.remove(version.id), () => [
        changed.version(),
        changed.history(version.templateId),
      ]),
    putBack: (versionId: string) =>
      writeAndRefresh(getDb().versions.putBack(versionId), (restored) => [
        changed.version(),
        changed.history(restored.templateId),
      ]),
  },

  bundles: {
    /** The given templates, or every one, with their drafts and whole history. */
    export: (templateIds?: string[]) => getDb().bundle.export(templateIds),
    /** Restoring can replace anything, so everything kept is read again. */
    import: (text: string, mode: ImportMode) =>
      writeAndRefresh(getDb().bundle.import(text, mode), () => [
        changed.version(),
        changed.history(),
        changed.draft(),
      ]),
  },
};

/**
 * A read of `storage` in a component: it suspends until the first read, then draws each
 * new result once a write has read it again. A null `id` reads nothing.
 */
export function useStored<T>(read: (id: string) => Promise<T>, id: string): T;
export function useStored<T>(read: (id: string) => Promise<T>, id: string | null): T | null;
export function useStored<T>(read: (id: string) => Promise<T>, id: string | null) {
  // Draws again when a reload swaps a result in, so the read below picks it up.
  useSyncExternalStore(cache.subscribe, cache.getRevision);
  return id === null ? null : use(read(id));
}
