import type { ResumeData } from '@/types/resume';

/*
 * Records the main-process database hands out. Both sides import these: main's
 * repositories return them, and the renderer receives them over the preload bridge.
 * Timestamps are epoch milliseconds.
 */

/** `named` versions are the user's checkpoints; `auto` ones are taken for them. */
export type VersionKind = 'auto' | 'named';

/** What produced a version row. */
export type VersionSource =
  | 'create' // a new template's first version
  | 'duplicate' // copied from another template
  | 'name' // the user named the draft
  | 'import' // a resume import (pasted text, later PDF/DOCX), or the draft it replaced
  | 'restore'; // taken before, or produced by, restoring an older version

export interface VersionMeta {
  id: string;
  templateId: string;
  parentId: string | null;
  kind: VersionKind;
  source: VersionSource;
  /** The user's name for a named version, or a description of an auto one. */
  summary: string;
  /** The template rev the snapshot was taken at. The draft is clean iff its rev matches the head's. */
  rev: number;
  createdAt: number;
}

export interface Version extends VersionMeta {
  doc: ResumeData;
}

export interface TemplateSummary {
  id: string;
  name: string;
  /** Bumped by every draft edit; see `Draft.rev`. */
  rev: number;
  createdAt: number;
  updatedAt: number;
  versionCount: number;
  /** The newest version. Every template has at least one. */
  head: VersionMeta;
}

/** What is in the editor for one template. */
export interface Draft {
  templateId: string;
  doc: ResumeData;
  /** Anchor-invalidation counter: changes whenever the document does. */
  rev: number;
}

export interface BootState {
  settings: Record<string, string>;
  templates: TemplateSummary[];
  /**
   * The draft to open: the last active template, or the most recently edited one.
   * Null when there are no templates — the user deleted them all.
   */
  draft: Draft | null;
}

export interface AutoSnapshot {
  templateId: string;
  source: VersionSource;
  summary: string;
}

/**
 * The renderer's view of the database: domain methods only, never SQL. Each call is one
 * main-process transaction; main validates every argument before touching the database.
 */
export interface MosaicDb {
  /** Settings, template summaries, and the draft to open — everything the first paint needs. */
  boot(): Promise<BootState>;
  templates: {
    list(): Promise<TemplateSummary[]>;
    /** `importedFrom` names an import's source for history ("pasted text"). */
    create(name: string, doc: ResumeData, importedFrom?: string): Promise<TemplateSummary>;
    rename(id: string, name: string): Promise<void>;
    duplicate(id: string): Promise<TemplateSummary>;
    remove(id: string): Promise<void>;
    /** Loads a template's draft and remembers it for the next launch. */
    open(id: string): Promise<Draft>;
  };
  drafts: {
    /** Refused with `stale-rev` when `rev` is older than the stored one. */
    save(templateId: string, doc: ResumeData, rev: number): Promise<void>;
    /** Replaces the draft, keeping unsaved edits as a "Before importing …" version. */
    importInto(templateId: string, doc: ResumeData, from: string): Promise<Draft>;
  };
  versions: {
    /** Newest first, without documents. */
    list(templateId: string): Promise<VersionMeta[]>;
    get(versionId: string): Promise<Version>;
    /** Renames the newest version if the draft matches it, otherwise adds a named one. */
    name(templateId: string, name: string): Promise<VersionMeta>;
    restore(templateId: string, versionId: string): Promise<Draft>;
  };
  settings: {
    set(key: string, value: string): Promise<void>;
    remove(key: string): Promise<void>;
  };
}

export type DbErrorCode = 'not-found' | 'stale-rev' | 'invalid-argument' | 'internal';

/**
 * How a call's outcome crosses IPC. Failures travel as data: Electron keeps only the
 * message of an error thrown across `invoke`, and the renderer needs the code.
 */
export type DbResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: DbErrorCode; message: string };

type Bridged<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => Promise<infer R>
    ? (...args: A) => Promise<DbResult<R>>
    : Bridged<T[K]>;
};

/** `window.mosaic.db`: `MosaicDb` with every result wrapped in a `DbResult`. */
export type MosaicDbBridge = Bridged<MosaicDb>;
