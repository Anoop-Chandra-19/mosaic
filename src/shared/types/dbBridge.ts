import type { ImportMode, ImportResult, MosaicBundle } from './bundle';
import type {
  AppliedHistory,
  BootState,
  Draft,
  NamingMode,
  SnapshotOccasion,
  TemplateSummary,
  Version,
  VersionMeta,
} from './db';
import type { ResumeData } from './resume';

/*
 * The contract between the renderer and main's database: what `window.mosaic.db` can do,
 * and how each outcome crosses IPC. The returned records are defined in `db.ts`.
 */

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
    /** Reads a template's draft without opening it or changing the last active template. */
    get(templateId: string): Promise<Draft>;
    /** Refused with `stale-rev` when `rev` is older than the stored one. */
    save(templateId: string, doc: ResumeData, rev: number): Promise<void>;
    /**
     * Replaces the draft. When `isRecorded`, unsaved edits are kept as a "Before importing …"
     * version and the import is saved as a separate version.
     */
    importInto(
      templateId: string,
      doc: ResumeData,
      from: string,
      isRecorded: boolean
    ): Promise<Draft>;
  };
  versions: {
    /** Newest first, without documents. */
    list(templateId: string): Promise<VersionMeta[]>;
    get(versionId: string): Promise<Version>;
    /**
     * Renames the newest version if the draft matches it, otherwise adds a named one: a new
     * number, or with `add` a revision of the newest. `add` is refused with `stale-rev` when
     * the newest version isn't the user's own (`canAddToVersion`).
     */
    name(templateId: string, name: string, mode: NamingMode): Promise<VersionMeta>;
    /**
     * Keeps the draft as an auto version, unless the newest version already holds it. An
     * open editing session gets a revision instead of a new number.
     */
    snapshot(templateId: string, occasion: SnapshotOccasion): Promise<VersionMeta>;
    /**
     * Saves the draft after applying suggestions. `summary` describes the applied changes
     * ("4 suggestions in Harbor Freight Labs"), unless the user named it. `add` is refused
     * with `stale-rev` unless the newest version is the assistant's.
     */
    snapshotApplied(
      templateId: string,
      summary: string,
      history: AppliedHistory
    ): Promise<VersionMeta>;
    /**
     * Restores a version as its template's draft. The version must belong to the given
     * template, keeping each template's history separate.
     * `shouldKeepDraft` keeps unsaved edits as a "Before restoring …" version first.
     */
    restore(templateId: string, versionId: string, shouldKeepDraft: boolean): Promise<Draft>;
    /** A new template from this version; the version says which template it came from. */
    duplicate(versionId: string): Promise<TemplateSummary>;
    /** Names any version to keep it indefinitely; renames an already named version. */
    rename(versionId: string, name: string): Promise<VersionMeta>;
    /**
     * Deletes a version, except the newest, which is used to track changes to the draft.
     * Its children link to its parent instead. Refused with `invalid-argument` for the newest.
     */
    remove(versionId: string): Promise<void>;
    /** Undoes a `remove` made since the app started. Fails with `not-found` if undo is no longer possible. */
    putBack(versionId: string): Promise<VersionMeta>;
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
 * How a call's outcome crosses IPC. Failures are returned as data: Electron keeps only the
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
