import { migrateResume } from '@shared/resume/migrateResume';
import type { ResumeData } from '@shared/types/resume';

export function encodeStoredResume(doc: ResumeData): string {
  return JSON.stringify(doc);
}

/** Documents are upgraded as they are read, so rows written by older builds keep working. */
export function parseAndMigrateStoredResume(text: string): ResumeData {
  return migrateResume(JSON.parse(text) as ResumeData);
}
