import type { ResumeData } from './resume';

/*
 * Records returned by the main-process database repositories and received by the
 * renderer over the preload bridge. Both processes import these types.
 * Timestamps are epoch milliseconds.
 */

export const MAX_DB_TEXT_LENGTH = 200;

/**
 * Validates IDs and names accepted by main. Restores use the same rules so restored
 * templates can still be saved and removed.
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
  | 'edit' // automatic snapshot during editing
  | 'switched' // the draft when the user switched to another template
  | 'closed' // the draft when the window closed
  | 'assistant' // the draft right after accepted suggestions were applied
  | 'before-apply'; // the draft just before accepted suggestions were applied

export type SnapshotOccasion = Extract<
  VersionSource,
  'edit' | 'switched' | 'closed' | 'before-apply'
>;

/** Names the draft as a new version or a revision of the newest version. */
export type NamingMode = 'new' | 'add';

/** Records applied suggestions as a new version, a revision of the newest, or a named version. */
export type AppliedHistory = { mode: 'new' } | { mode: 'add' } | { mode: 'named'; name: string };

export interface VersionMeta {
  id: string;
  templateId: string;
  /** The version number in the template's history, as in "v7". Deleting other versions never changes it. */
  number: number;
  /** Revisions are added only to the newest version number: 0 is v7, 1 is v7.1. */
  revision: number;
  parentId: string | null;
  kind: VersionKind;
  source: VersionSource;
  /** The user's name for a named version, or a description of an auto one. */
  summary: string;
  /** The one section an edit snapshot touched, by the label it had then. */
  section: string | null;
  /**
   * The template's rev at the snapshot. The draft is clean if and only if its rev matches
   * the newest version's rev.
   */
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
  /** Increments whenever the document changes, invalidating the agent's anchors. */
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
