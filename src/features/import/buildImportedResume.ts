import type { ContactInfo, ResumeData, ResumeSection } from '@/types/resume';
import type { ParsedResume } from './parseResumeText';

/**
 * `new` opens the import as its own template; `replace` swaps the open template's content
 * for it; `merge` appends it to what is there.
 */
export type ImportMode = 'new' | 'replace' | 'merge';

export interface ImportSummary {
  sectionCount: number;
  entryCount: number;
  bulletCount: number;
  contactName: string;
}

export function describeImport(parsed: ParsedResume): ImportSummary {
  const { sections, contact } = parsed.resume;
  const entryCount = sections.reduce((sum, section) => sum + section.items.length, 0);
  const bulletCount = sections.reduce(
    (sum, section) => sum + section.items.reduce((n, item) => n + item.bullets.length, 0),
    0
  );
  return {
    sectionCount: sections.length,
    entryCount,
    bulletCount,
    contactName: contact.name,
  };
}

/** Fill only the contact fields that are currently empty. */
function mergeContact(current: ContactInfo, incoming: ContactInfo): ContactInfo {
  const merged: ContactInfo = { ...current };
  (Object.keys(incoming) as (keyof ContactInfo)[]).forEach((key) => {
    if (typeof incoming[key] === 'string' && current[key] === '' && incoming[key] !== '') {
      (merged[key] as string) = incoming[key] as string;
    }
  });
  return merged;
}

/** Append incoming sections into existing ones of the same type, or add them. */
function mergeSections(current: ResumeSection[], incoming: ResumeSection[]): ResumeSection[] {
  const sections = current.map((section) => ({ ...section, items: [...section.items] }));
  for (const section of incoming) {
    const target = sections.find((existing) => existing.type === section.type);
    if (target) {
      target.items.push(...section.items);
    } else {
      sections.push({ ...section, order: sections.length });
    }
  }
  return sections;
}

/**
 * The document an import produces. `new` and `replace` take the parsed resume as it is;
 * `merge` appends its sections into `current` and only fills empty contact fields.
 */
export function buildImportedResume(
  current: ResumeData,
  parsed: ParsedResume,
  mode: ImportMode
): ResumeData {
  if (mode !== 'merge') {
    return {
      schemaVersion: current.schemaVersion,
      contact: parsed.resume.contact,
      sections: parsed.resume.sections,
    };
  }
  return {
    schemaVersion: current.schemaVersion,
    contact: mergeContact(current.contact, parsed.resume.contact),
    sections: mergeSections(current.sections, parsed.resume.sections),
  };
}
