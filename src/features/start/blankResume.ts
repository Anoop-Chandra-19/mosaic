import { createEmptyResume } from '@/lib/resume/defaultResume';
import { createHeaderItem, createHeaderLine } from '@/lib/resume/resumeHeader';
import { SECTION_PRESETS } from '@/lib/resume/sectionPresets';
import type { BuiltInSectionKind, HeaderItemKind, ResumeData } from '@/types/resume';

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

/** The header items nearly everyone fills in, empty, in the Headless format's two lines. */
const STARTER_HEADER: HeaderItemKind[][] = [
  ['phone', 'email', 'linkedin'],
  ['auth', 'location'],
];

export function createBlankResume(): ResumeData {
  const doc = createEmptyResume();
  doc.contact.header.lines = STARTER_HEADER.map((kinds) =>
    createHeaderLine(kinds.map((kind) => createHeaderItem(kind)))
  );
  doc.sections = STARTER_KINDS.slice(0, 3).map((kind, order) => ({
    id: crypto.randomUUID(),
    kind,
    ...SECTION_PRESETS[kind],
    order,
    items: [],
  }));
  return doc;
}
