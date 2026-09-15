import type { ResumeData, SectionKind, SectionLayout } from '@/types/resume';
import { normalizeContact, type NormalizedContact } from '@/lib/resume/contactFormatting';

export interface ExportEntry {
  id: string;
  title: string;
  subtitle: string;
  text: string;
  bullets: string[];
  startDate?: string;
  endDate?: string;
}

export interface ExportSection {
  id: string;
  kind: SectionKind;
  layout: SectionLayout;
  label: string;
  entries: ExportEntry[];
}

export interface NormalizedResumeExport {
  contact: NormalizedContact;
  sections: ExportSection[];
}

function trim(value: string | undefined) {
  return (value ?? '').trim();
}

function normalizeTextOnlyEntry(id: string, text: string): ExportEntry | null {
  const cleanText = trim(text);
  if (!cleanText) {
    return null;
  }

  return {
    id,
    title: '',
    subtitle: '',
    text: cleanText,
    bullets: [],
  };
}

export function normalizeResumeForExport(resume: ResumeData): NormalizedResumeExport {
  // Export only selected, non-empty content so all output formats share the same rules.
  const sections = resume.sections
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((section) => {
      const entries = section.items
        .filter((entry) => entry.selected)
        .map((entry) => {
          if (section.layout === 'lines') {
            return normalizeTextOnlyEntry(entry.id, entry.text ?? '');
          }

          const title = trim(entry.title);
          const subtitle = trim(entry.subtitle);
          const bullets = entry.bullets
            .filter((bullet) => bullet.selected)
            .map((bullet) => trim(bullet.text))
            .filter(Boolean);

          if (!title && !subtitle && bullets.length === 0) {
            return null;
          }

          return {
            id: entry.id,
            title,
            subtitle,
            text: '',
            bullets,
            startDate: trim(entry.startDate) || undefined,
            endDate: trim(entry.endDate) || undefined,
          } satisfies ExportEntry;
        })
        .filter((entry): entry is ExportEntry => entry !== null);

      return {
        id: section.id,
        kind: section.kind,
        layout: section.layout,
        label: trim(section.label),
        entries,
      } satisfies ExportSection;
    })
    .filter((section) => section.entries.length > 0);

  return {
    contact: normalizeContact(resume.contact),
    sections,
  };
}
