import { createEmptyResume } from '@/lib/resume/defaultResume';
import type { ResumeData, SectionType } from '@/types/resume';

/**
 * The sections nearly everyone ends up adding. A blank resume starts with the first three;
 * the editor offers the rest while the document is still empty.
 */
export const STARTER_SECTIONS: { type: SectionType; label: string }[] = [
  { type: 'experience', label: 'Experience' },
  { type: 'education', label: 'Education' },
  { type: 'skills', label: 'Skills' },
  { type: 'projects', label: 'Projects' },
];

export function createBlankResume(): ResumeData {
  const doc = createEmptyResume();
  doc.sections = STARTER_SECTIONS.slice(0, 3).map(({ type, label }, order) => ({
    id: crypto.randomUUID(),
    type,
    label,
    order,
    items: [],
  }));
  return doc;
}
