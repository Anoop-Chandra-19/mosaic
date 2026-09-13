import { migrateResume } from '@/lib/resume/migrateResume';
import type { ResumeData } from '@/types/resume';

export function encodeDoc(doc: ResumeData): string {
  return JSON.stringify(doc);
}

/** Documents are upgraded as they are read, so rows written by older builds keep working. */
export function decodeDoc(text: string): ResumeData {
  return migrateResume(JSON.parse(text) as ResumeData);
}
