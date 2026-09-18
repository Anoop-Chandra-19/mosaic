import { getPrintableHeaderLines } from '@shared/resume/resumeHeader';
import type { ContactInfo, ResumeData, ResumeSection } from '@shared/types/resume';
import type { ParsedResume } from './parseResume';

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

/** Whether a merge keeps the open resume's header: it does when that header prints anything. */
export const keepsHeader = (current: ContactInfo) =>
  getPrintableHeaderLines(current.header).length > 0;

/** The name only if there is none; the header whole, only if the current one prints nothing. */
function mergeContact(current: ContactInfo, incoming: ContactInfo): ContactInfo {
  return {
    name: current.name.trim() ? current.name : incoming.name,
    header: keepsHeader(current) ? current.header : incoming.header,
  };
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Whether `incoming` goes into `existing`: a built-in section into the first of its kind,
 * a custom section into the custom section of the same name. Only ever into a section of
 * the same shape, so no item loses the fields it prints with.
 */
function belongsIn(existing: ResumeSection, incoming: ResumeSection): boolean {
  if (existing.kind !== incoming.kind || existing.layout !== incoming.layout) return false;
  return incoming.kind !== 'custom' || sameName(existing.label, incoming.label);
}

/** Append incoming sections into the existing ones they belong in, or add them. */
function mergeSections(current: ResumeSection[], incoming: ResumeSection[]): ResumeSection[] {
  const sections = current.map((section) => ({ ...section, items: [...section.items] }));
  for (const section of incoming) {
    const target = sections.find((existing) => belongsIn(existing, section));
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
 * `merge` appends its sections into `current`, and takes its name and header only where
 * `current` has none.
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
