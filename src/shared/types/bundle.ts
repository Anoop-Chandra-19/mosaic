import type { ResumeData } from './resume';
import type { VersionKind, VersionSource } from './db';

/**
 * The backup file's format. Each distinct document is written once, in `docs`; drafts and
 * versions reference their documents through `draftDocId` and `docId`.
 */
export const BUNDLE_VERSION = 3 as const;

/**
 * The user-owned backup file: one template or all of them, with drafts and full
 * version history. Document data only — settings, AI configuration, keys, and
 * conversations never appear in a bundle. Timestamps are ISO strings so the file
 * stays readable.
 *
 * In memory each version holds its document; versions with the same document share one
 * object. `formatBundle` writes it as a file, `parseBundle` reads one back.
 */
export interface MosaicBundle {
  exportedAt: string;
  templates: BundleTemplate[];
}

export interface BundleTemplate {
  template: { id: string; name: string; rev: number; createdAt: string; updatedAt: string };
  draft: ResumeData;
  /** Oldest first. Never empty: the last entry is the head version. */
  versions: BundleVersion[];
}

export interface BundleVersion {
  id: string;
  /** Version number, as in "v7", preserved on restore. Ordered by number, then revision. */
  number: number;
  /** Revision, as in 1 for "v7.1". Increases within a number; older files omit it and are read as 0. */
  revision: number;
  /** Always an earlier version of the same template, or null. */
  parentId: string | null;
  kind: VersionKind;
  source: VersionSource;
  summary: string;
  section: string | null;
  rev: number;
  createdAt: string;
  doc: ResumeData;
}

/**
 * `restore-all` replaces every template with the bundle's templates, preserving IDs,
 * drafts, and history. `as-new-template` adds the bundle's templates with new IDs to avoid
 * conflicts with existing templates.
 */
export type ImportMode = 'restore-all' | 'as-new-template';

/** A backup file that parsed, ready to confirm and restore. */
export interface OpenedBackup {
  fileName: string;
  text: string;
  bundle: MosaicBundle;
}

export interface ImportResult {
  /** The imported templates' ids as stored, in bundle order. */
  templateIds: string[];
}
