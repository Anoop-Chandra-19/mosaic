import type { ImportMode, ImportResult, MosaicBundle } from './bundle';
import type { ResumeData } from './resume';

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
  | 'restore' // taken before, or produced by, restoring an older version
  | 'edit' // editing alone, kept for the user as they go
  | 'switched' // where the draft stood when another template took the editor
  | 'closed'; // where the draft stood when the window closed

export type SnapshotOccasion = Extract<VersionSource, 'edit' | 'switched' | 'closed'>;

export interface VersionMeta {
  id: string;
  templateId: string;
  parentId: string | null;
  kind: VersionKind;
  source: VersionSource;
  /** The user's name for a named version, or a description of an auto one. */
  summary: string;
  /** The one section an edit snapshot touched, by the label it had then. */
  section: string | null;
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
    /** Copies the draft, unsaved edits included, into a new template. */
    duplicate(id: string): Promise<TemplateSummary>;
    remove(id: string): Promise<void>;
    /** Loads a template's draft and remembers it for the next launch. */
    open(id: string): Promise<Draft>;
  };
  drafts: {
    /** A template's draft, read without opening the template or remembering it. */
    get(templateId: string): Promise<Draft>;
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
    /** Keeps the draft as an auto version, unless the newest version already holds it. */
    snapshot(templateId: string, occasion: SnapshotOccasion): Promise<VersionMeta>;
    /**
     * Puts a version back as its template's draft. Template-scoped: the version must be
     * one of that template's own, so each template's history stays self-contained.
     */
    restore(templateId: string, versionId: string): Promise<Draft>;
    /** A new template from this version; the version says which template it came from. */
    duplicate(versionId: string): Promise<TemplateSummary>;
  };
  settings: {
    set(key: string, value: string): Promise<void>;
    remove(key: string): Promise<void>;
  };
  /** Backup files: templates with their drafts and full history, as readable JSON. */
  bundle: {
    /** The given templates, or every one of them. */
    export(templateIds?: string[]): Promise<MosaicBundle>;
    /**
     * Writes a backup file's templates. Main checks the text again with `parseBundle`, so a
     * bad file is refused with `invalid-argument` and changes nothing.
     */
    import(text: string, mode: ImportMode): Promise<ImportResult>;
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
