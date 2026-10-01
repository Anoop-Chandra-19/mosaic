import type { ResumeData } from '../types/resume';

export const CURRENT_SCHEMA_VERSION = 1;

/**
 * Migrate a ResumeData snapshot to the current schema version.
 * No-op today. Becomes the migration hook when the resume shape evolves.
 * Throws on a newer version, which this build can't read.
 */
export function migrateResume(data: ResumeData): ResumeData {
  if (data.schemaVersion === CURRENT_SCHEMA_VERSION) return data;
  if (data.schemaVersion > CURRENT_SCHEMA_VERSION) {
    throw new Error(`A newer Mosaic wrote this resume (schema version ${data.schemaVersion})`);
  }

  // Future migrations go here as chained if-blocks:
  // if (data.schemaVersion < 2) { ... migrate to v2 ... }

  return { ...data, schemaVersion: CURRENT_SCHEMA_VERSION };
}
