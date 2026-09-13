import type { Database } from 'better-sqlite3';
import { isResumeData } from '@/lib/resume/validateResume';
import type { DbResult, MosaicDb } from '@/types/db';
import type { ResumeData } from '@/types/resume';
import type { DbMethod } from '../../shared/dbMethods';
import { boot } from '../db/boot';
import { saveDraft } from '../db/drafts';
import { StorageError } from '../db/errors';
import { removeSetting, setSetting } from '../db/settings';
import {
  createTemplate,
  duplicateTemplate,
  duplicateVersion,
  listTemplates,
  openTemplate,
  removeTemplate,
  renameTemplate,
} from '../db/templates';
import {
  getVersion,
  importIntoDraft,
  listVersions,
  nameDraft,
  restoreVersion,
} from '../db/versions';

/*
 * Main's side of `MosaicDb`, kept free of Electron so tests can drive it directly;
 * `./db.ts` wires it to IPC.
 */

/** Synchronous, and every argument arrives unchecked. */
export type Handlers<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => Promise<infer R>
    ? (...args: { [I in keyof A]: unknown }) => R
    : Handlers<T[K]>;
};

class InvalidArgumentError extends Error {}

function text(value: unknown, what: string, maxLength = 200): string {
  if (typeof value !== 'string' || value.trim() === '' || value.length > maxLength) {
    throw new InvalidArgumentError(`${what} must be text of 1–${maxLength} characters`);
  }
  return value;
}

function optionalText(value: unknown, what: string): string | undefined {
  return value === undefined ? undefined : text(value, what);
}

function resume(value: unknown): ResumeData {
  if (!isResumeData(value)) throw new InvalidArgumentError('doc is not a resume');
  return value;
}

function revision(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new InvalidArgumentError('rev must be a whole number of 0 or more');
  }
  return value as number;
}

function settingValue(value: unknown): string {
  // Settings are small JSON blobs (panel sizes, AI config); this only stops a runaway.
  if (typeof value !== 'string' || value.length > 1_000_000) {
    throw new InvalidArgumentError('value must be text under 1 MB');
  }
  return value;
}

export function createDbHandlers(db: Database): Handlers<MosaicDb> {
  return {
    boot: () => boot(db),
    templates: {
      list: () => listTemplates(db),
      create: (name, doc, importedFrom) =>
        createTemplate(
          db,
          text(name, 'name'),
          resume(doc),
          optionalText(importedFrom, 'importedFrom')
        ),
      rename: (id, name) => renameTemplate(db, text(id, 'id'), text(name, 'name')),
      duplicate: (id) => duplicateTemplate(db, text(id, 'id')),
      remove: (id) => removeTemplate(db, text(id, 'id')),
      open: (id) => openTemplate(db, text(id, 'id')),
    },
    drafts: {
      save: (templateId, doc, rev) =>
        saveDraft(db, text(templateId, 'templateId'), resume(doc), revision(rev)),
      importInto: (templateId, doc, from) =>
        importIntoDraft(db, text(templateId, 'templateId'), resume(doc), text(from, 'from')),
    },
    versions: {
      list: (templateId) => listVersions(db, text(templateId, 'templateId')),
      get: (versionId) => getVersion(db, text(versionId, 'versionId')),
      name: (templateId, name) => nameDraft(db, text(templateId, 'templateId'), text(name, 'name')),
      restore: (templateId, versionId) =>
        restoreVersion(db, text(templateId, 'templateId'), text(versionId, 'versionId')),
      duplicate: (versionId) => duplicateVersion(db, text(versionId, 'versionId')),
    },
    settings: {
      set: (key, value) => setSetting(db, text(key, 'key'), settingValue(value)),
      remove: (key) => removeSetting(db, text(key, 'key')),
    },
  };
}

type Handler = (...args: unknown[]) => unknown;

/** The handler for "templates.create" and the like. */
export function handlerFor(handlers: Handlers<MosaicDb>, method: DbMethod): Handler {
  let node: unknown = handlers;
  for (const key of method.split('.')) node = (node as Record<string, unknown>)[key];
  if (typeof node !== 'function') throw new Error(`No handler for ${method}`);
  return node as Handler;
}

/**
 * Run one call and report how it went. Refusals the UI can explain keep their code; a
 * bug or disk failure is logged here and reaches the renderer as `internal`. Either way
 * the call's transaction rolled back, so nothing was half-written.
 */
export function settle(run: () => unknown): DbResult<unknown> {
  try {
    return { ok: true, value: run() };
  } catch (error) {
    if (error instanceof StorageError) {
      return { ok: false, code: error.code, message: error.message };
    }
    if (error instanceof InvalidArgumentError) {
      return { ok: false, code: 'invalid-argument', message: error.message };
    }
    console.error(error);
    return { ok: false, code: 'internal', message: (error as Error).message };
  }
}
