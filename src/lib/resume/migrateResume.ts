import type { ResumeData } from '@/types/resume';

const CURRENT_SCHEMA_VERSION = 1;

/**
 * Migrate a ResumeData snapshot to the current schema version.
 * No-op today. Becomes the migration hook when the resume shape evolves.
 */
export function migrateResume(data: ResumeData): ResumeData {
  if (data.schemaVersion === CURRENT_SCHEMA_VERSION) return data;

  // Future migrations go here as chained if-blocks:
  // if (data.schemaVersion < 2) { ... migrate to v2 ... }

  return { ...data, schemaVersion: CURRENT_SCHEMA_VERSION };
}
