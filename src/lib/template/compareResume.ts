import type { ResumeData } from '@/types/resume';

/**
 * Deep-compare two ResumeData snapshots for equality.
 * Uses stable JSON serialization. Fast enough for v1 resume payloads.
 */
export function resumeEqual(a: ResumeData, b: ResumeData): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
