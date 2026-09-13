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
