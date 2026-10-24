import type { ResumeData } from './resume';

/*
 * Records the main-process database hands out. Both sides import these: main's
 * repositories return them, and the renderer receives them over the preload bridge.
 * Timestamps are epoch milliseconds.
 */

export const MAX_DB_TEXT_LENGTH = 200;

/**
 * What main accepts as an ID or a name. A restore holds to it as well, or it could store
 * a template nothing can save to or remove.
 */
export function isDbText(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '' && value.length <= MAX_DB_TEXT_LENGTH;
}

/** `named` versions are the user's checkpoints; `auto` ones are taken for them. */
export type VersionKind = 'auto' | 'named';

/** What produced a version row. */
export type VersionSource =
  | 'create' // a new template's first version
  | 'duplicate' // copied from another template
  | 'name' // the user named the draft
  | 'import' // a resume import (pasted text, later PDF/DOCX)
  | 'before-import' // the draft an import replaced
  | 'restore' // produced by restoring an older version
  | 'before-restore' // the draft a restore replaced
  | 'edit' // editing alone, kept for the user as they go
  | 'switched' // where the draft stood when another template took the editor
  | 'closed' // where the draft stood when the window closed
  | 'assistant' // the draft right after accepted suggestions were applied
  | 'before-apply'; // the draft just before accepted suggestions were applied

export type SnapshotOccasion = Extract<
  VersionSource,
  'edit' | 'switched' | 'closed' | 'before-apply'
>;

/** Naming the draft as a version of its own, or as a revision of the newest version. */
export type NamingMode = 'new' | 'add';

/** How applied suggestions go into history: their own version, added to the newest, or named. */
export type AppliedHistory = { mode: 'new' } | { mode: 'add' } | { mode: 'named'; name: string };

export interface VersionMeta {
  id: string;
  templateId: string;
  /** Its place in the template's history when it was taken: "v7". Deleting others never changes it. */
  number: number;
  /** Additions to that number while it was the newest: 0 is v7 itself, 1 is v7.1. */
  revision: number;
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

/** The draft kept just before something replaces it. */
export interface AutoSnapshot {
  templateId: string;
  source: Extract<VersionSource, 'before-restore' | 'before-import'>;
  summary: string;
}
