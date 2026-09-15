import { createEmptyResume } from '@/lib/resume/defaultResume';
import { SECTION_PRESETS } from '@/lib/resume/sectionPresets';
import type { BuiltInSectionKind, ResumeData } from '@/types/resume';

/**
 * The sections nearly everyone ends up adding. A blank resume starts with the first three;
 * the editor offers the rest while the document is still empty.
 */
export const STARTER_KINDS: BuiltInSectionKind[] = [
  'experience',
  'education',
  'skills',
  'projects',
];

export function createBlankResume(): ResumeData {
  const doc = createEmptyResume();
  doc.sections = STARTER_KINDS.slice(0, 3).map((kind, order) => ({
    id: crypto.randomUUID(),
    kind,
    ...SECTION_PRESETS[kind],
    order,
    items: [],
  }));
  return doc;
}
