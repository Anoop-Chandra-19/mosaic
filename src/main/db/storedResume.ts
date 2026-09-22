import { createHash } from 'node:crypto';
import { migrateResume } from '@shared/resume/migrateResume';
import type { ResumeData } from '@shared/types/resume';

/** Keys sorted at every level, so the same resume is always the same text and hash. */
export function encodeStoredResume(doc: ResumeData): string {
  return JSON.stringify(doc, (_key, value: unknown) =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => (a < b ? -1 : 1)))
      : value
  );
}

export function hashStoredResume(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

/** Documents are upgraded as they are read, so rows written by older builds keep working. */
export function parseAndMigrateStoredResume(text: string): ResumeData {
  return migrateResume(JSON.parse(text) as ResumeData);
}
