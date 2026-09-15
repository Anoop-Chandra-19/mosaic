import { normalizeResumeForExport } from '@/features/export/normalizeResumeExport';
import { getContactPrimaryLine, getContactSecondaryLine } from '@/lib/resume/contactFormatting';
import type { ResumeData } from '@/types/resume';

/**
 * Words on the page. Counted over what export would write — so hidden entries and bullets
 * don't count — and separators like "|" or "—" aren't words.
 */
export function countWords(doc: ResumeData): number {
  const { contact, sections } = normalizeResumeForExport(doc);
  const text = [
    contact.name,
    getContactPrimaryLine(contact),
    getContactSecondaryLine(contact),
    ...sections.flatMap((section) => [
      section.label,
      ...section.entries.flatMap((entry) => [
        entry.title,
        entry.subtitle,
        entry.text,
        ...entry.bullets,
      ]),
    ]),
  ].join(' ');
  return text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}
