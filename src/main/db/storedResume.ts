import { createHash } from 'node:crypto';
import { encodeResumeCanonically } from '@shared/resume/encodeResumeCanonically';
import { migrateResume } from '@shared/resume/migrateResume';
import type { ResumeData } from '@shared/types/resume';

/** The same resume is always the same text, and so the same hash. */
export const encodeStoredResume = encodeResumeCanonically;

export function hashStoredResume(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

/** Documents are upgraded as they are read, so rows written by older builds keep working. */
export function parseAndMigrateStoredResume(text: string): ResumeData {
  return migrateResume(JSON.parse(text) as ResumeData);
}
