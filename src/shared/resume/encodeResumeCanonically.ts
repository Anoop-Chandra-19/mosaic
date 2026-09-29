import type { ResumeData } from '../types/resume';

/** Keys sorted at every level, so the same resume is always the same text. */
export function encodeResumeCanonically(doc: ResumeData): string {
  return JSON.stringify(doc, (_key, value: unknown) =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => (a < b ? -1 : 1)))
      : value
  );
}
