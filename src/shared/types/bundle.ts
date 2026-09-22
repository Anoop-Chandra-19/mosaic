import type { ResumeData } from './resume';
import type { VersionKind, VersionSource } from './db';

export const BUNDLE_VERSION = 2 as const;

/**
 * The user-owned backup file: one template or all of them, with drafts and full
 * version history. Document data only — settings, AI configuration, keys, and
 * conversations never appear in a bundle. Timestamps are ISO strings so the file
 * stays readable.
 */
export interface MosaicBundle {
  bundleVersion: typeof BUNDLE_VERSION;
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
 * `restore-all` replaces every template with the bundle's, ids included, so a backup
 * rebuilds the app exactly. `as-new-template` adds the bundle's templates under fresh
 * ids, so nothing collides with what is already there.
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
