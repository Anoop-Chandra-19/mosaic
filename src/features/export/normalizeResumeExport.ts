import type { LinkStyle, ResumeData, SectionKind, SectionLayout } from '@/types/resume';
import { getPrintableHeaderLines, type PrintedHeaderLine } from '@/lib/resume/resumeHeader';

export interface ExportEntry {
  id: string;
  title: string;
  subtitle: string;
  text: string;
  bullets: string[];
}

export interface ExportSection {
  id: string;
  kind: SectionKind;
  layout: SectionLayout;
  label: string;
  entries: ExportEntry[];
}

/** The top of the page as it prints: the name, and the header's printed lines. */
export interface ExportContact {
  name: string;
  linkStyle: LinkStyle;
  lines: PrintedHeaderLine[];
}

export interface NormalizedResumeExport {
  contact: ExportContact;
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

  const { name, header } = resume.contact;
  return {
    contact: {
      name: trim(name),
      linkStyle: header.linkStyle,
      lines: getPrintableHeaderLines(header),
    },
    sections,
  };
}
