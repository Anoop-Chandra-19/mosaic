import { useResumeStore } from '@/stores/resumeStore';
import { useTemplateStore } from '@/stores/templateStore';
import type { ContactInfo, ResumeData, ResumeSection } from '@/types/resume';
import type { ParsedResume } from './parseResumeText';

export type ImportMode = 'replace' | 'merge';

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
 * Apply a parsed resume to the stores. `replace` swaps the whole document (and clears
 * ephemeral template diffs/rollbacks that would reference stale ids, as applyVault does).
 * `merge` appends parsed content into the current resume and only fills empty contact fields.
 */
export function applyImportedResume(parsed: ParsedResume, mode: ImportMode): void {
  const resumeStore = useResumeStore.getState();
  const current: ResumeData = {
    schemaVersion: resumeStore.schemaVersion,
    contact: resumeStore.contact,
    sections: resumeStore.sections,
  };

  if (mode === 'replace') {
    resumeStore.replaceResume({
      schemaVersion: current.schemaVersion,
      contact: parsed.resume.contact,
      sections: parsed.resume.sections,
    });
    useTemplateStore.setState({ pendingAiChanges: [], rollbackSnapshots: {} });
    return;
  }

  resumeStore.replaceResume({
    schemaVersion: current.schemaVersion,
    contact: mergeContact(current.contact, parsed.resume.contact),
    sections: mergeSections(current.sections, parsed.resume.sections),
  });
}
