import { normalizeResumeForExport } from '@/features/export/normalizeResumeExport';
import { formatHeaderLineText } from '@shared/resume/resumeHeader';
import type { ResumeData } from '@shared/types/resume';

/**
 * Words on the page. Counted over what export would write — so hidden entries and bullets
 * don't count — and separators like "|" or "—" aren't words.
 */
export function countWords(doc: ResumeData): number {
  const { contact, sections } = normalizeResumeForExport(doc);
  const text = [
    contact.name,
    ...contact.lines.map(formatHeaderLineText),
    ...sections.flatMap((section) => [
      section.label,
      ...section.entries.flatMap((entry) => [
        entry.heading,
        entry.dates,
        entry.text,
        ...entry.bullets,
      ]),
    ]),
  ].join(' ');
  return text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}
