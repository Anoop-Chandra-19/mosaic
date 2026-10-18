import type { Database } from 'better-sqlite3';
import { isResumeData } from '@shared/resume/validateResume';
import { parseBundle } from '@shared/vault/parseBundle';
import type { ImportMode, MosaicBundle } from '@shared/types/bundle';
import {
  isDbText,
  MAX_DB_TEXT_LENGTH,
  type AppliedHistory,
  type DbResult,
  type MosaicDb,
  type NamingMode,
  type SnapshotOccasion,
} from '@shared/types/db';
import type { ResumeData } from '@shared/types/resume';
import type { DbMethod } from '@shared/ipc/dbMethods';
import { readBootState } from '../db/readBootState';
import { exportBundle, importBundle } from '../db/resumes/bundle';
import { readDraft, saveDraft } from '../db/resumes/drafts';
import { putBackVersion, removeVersion, renameVersion } from '../db/resumes/versionEdits';
import { MAIN_SETTINGS_PREFIX, removeSetting, setSetting } from '../db/settings';
import { StorageError } from '../db/storageError';
import {
  createTemplate,
  duplicateTemplate,
  duplicateVersion,
  listTemplates,
  openTemplate,
  removeTemplate,
  renameTemplate,
} from '../db/resumes/templates';
import {
  getVersion,
  importIntoDraft,
  listVersions,
  nameDraft,
  restoreVersion,
  snapshotAppliedSuggestions,
  snapshotEditedDraft,
} from '../db/resumes/versions';

/*
 * Main's side of `MosaicDb`, kept free of Electron so tests can drive it directly;
 * `./registerDbHandlers.ts` wires it to IPC.
 */

/** Synchronous, and every argument arrives unchecked. */
export type Handlers<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => Promise<infer R>
    ? (...args: { [I in keyof A]: unknown }) => R
    : Handlers<T[K]>;
};

class InvalidArgumentError extends Error {}

function text(value: unknown, what: string): string {
  if (!isDbText(value)) {
    throw new InvalidArgumentError(`${what} must be text of 1–${MAX_DB_TEXT_LENGTH} characters`);
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

function yesOrNo(value: unknown, what: string): boolean {
  if (typeof value !== 'boolean') throw new InvalidArgumentError(`${what} must be true or false`);
  return value;
}

function revision(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new InvalidArgumentError('rev must be a whole number of 0 or more');
  }
  return value as number;
}

/** A setting the renderer may write: not one of main's own. */
function rendererSettingKey(value: unknown): string {
  const key = text(value, 'key');
  if (key.startsWith(MAIN_SETTINGS_PREFIX)) {
    throw new InvalidArgumentError(`"${key}" is kept by the app itself`);
  }
  return key;
}

function settingValue(value: unknown): string {
  // Settings are small JSON blobs (panel sizes, AI config); this only stops a runaway.
  if (typeof value !== 'string' || value.length > 1_000_000) {
    throw new InvalidArgumentError('value must be text under 1 MB');
  }
  return value;
}

function optionalIds(value: unknown, what: string): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new InvalidArgumentError(`${what} must be a list of ids`);
  return value.map((id: unknown) => text(id, what));
}

const IMPORT_MODES: ReadonlySet<unknown> = new Set<ImportMode>(['restore-all', 'as-new-template']);

function importMode(value: unknown): ImportMode {
  if (!IMPORT_MODES.has(value)) throw new InvalidArgumentError('mode is not an import mode');
  return value as ImportMode;
}

const SNAPSHOT_OCCASIONS: ReadonlySet<unknown> = new Set<SnapshotOccasion>([
  'edit',
  'switched',
  'closed',
  'before-apply',
]);

function snapshotOccasion(value: unknown): SnapshotOccasion {
  if (!SNAPSHOT_OCCASIONS.has(value)) throw new InvalidArgumentError('occasion is not known');
  return value as SnapshotOccasion;
}

const NAMING_MODES: ReadonlySet<unknown> = new Set<NamingMode>(['new', 'add']);

function namingMode(value: unknown): NamingMode {
  if (!NAMING_MODES.has(value)) throw new InvalidArgumentError('mode must be "new" or "add"');
  return value as NamingMode;
}

/** `{ mode: 'new' }`, `{ mode: 'add' }`, or `{ mode: 'named', name }` with a name main accepts. */
function appliedHistory(value: unknown): AppliedHistory {
  if (typeof value !== 'object' || value === null) {
    throw new InvalidArgumentError('history must say how the version is kept');
  }
  const { mode, name } = value as { mode?: unknown; name?: unknown };
  if (mode === 'new' || mode === 'add') return { mode };
  if (mode === 'named') return { mode, name: text(name, 'name') };
  throw new InvalidArgumentError('history must say how the version is kept');
}

/** A backup file's text, checked the same way whoever sent it already should have. */
function bundle(value: unknown): MosaicBundle {
  if (typeof value !== 'string') throw new InvalidArgumentError('text must be a backup file');
  const parsed = parseBundle(value);
  if (!parsed.ok) {
    throw new InvalidArgumentError(`not a Mosaic backup: ${parsed.detail ?? parsed.code}`);
  }
  return parsed.bundle;
}

export function createDbHandlers(db: Database): Handlers<MosaicDb> {
  return {
    boot: () => readBootState(db),
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
      get: (templateId) => readDraft(db, text(templateId, 'templateId')),
      save: (templateId, doc, rev) =>
        saveDraft(db, text(templateId, 'templateId'), resume(doc), revision(rev)),
      importInto: (templateId, doc, from, isRecorded) =>
        importIntoDraft(
          db,
          text(templateId, 'templateId'),
          resume(doc),
          text(from, 'from'),
          yesOrNo(isRecorded, 'isRecorded')
        ),
    },
    versions: {
      list: (templateId) => listVersions(db, text(templateId, 'templateId')),
      get: (versionId) => getVersion(db, text(versionId, 'versionId')),
      name: (templateId, name, mode) =>
        nameDraft(db, text(templateId, 'templateId'), text(name, 'name'), namingMode(mode)),
      snapshot: (templateId, occasion) =>
        snapshotEditedDraft(db, text(templateId, 'templateId'), snapshotOccasion(occasion)),
      snapshotApplied: (templateId, summary, history) =>
        snapshotAppliedSuggestions(
          db,
          text(templateId, 'templateId'),
          text(summary, 'summary'),
          appliedHistory(history)
        ),
      restore: (templateId, versionId, shouldKeepDraft) =>
        restoreVersion(
          db,
          text(templateId, 'templateId'),
          text(versionId, 'versionId'),
          yesOrNo(shouldKeepDraft, 'shouldKeepDraft')
        ),
      duplicate: (versionId) => duplicateVersion(db, text(versionId, 'versionId')),
      rename: (versionId, name) =>
        renameVersion(db, text(versionId, 'versionId'), text(name, 'name')),
      remove: (versionId) => removeVersion(db, text(versionId, 'versionId')),
      putBack: (versionId) => putBackVersion(db, text(versionId, 'versionId')),
    },
    settings: {
      set: (key, value) => setSetting(db, rendererSettingKey(key), settingValue(value)),
      remove: (key) => removeSetting(db, rendererSettingKey(key)),
    },
    bundle: {
      export: (templateIds) => exportBundle(db, optionalIds(templateIds, 'templateIds')),
      import: (fileText, mode) => importBundle(db, bundle(fileText), importMode(mode)),
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
