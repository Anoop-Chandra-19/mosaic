import type { LinkStyle, ResumeData, SectionKind, SectionLayout } from '@shared/types/resume';
import { formatEntryHeading, type EntryHeadingFields } from '@shared/resume/entryHeading';
import { getPrintableHeaderLines, type PrintedHeaderLine } from '@shared/resume/resumeHeader';

export interface ExportEntry extends EntryHeadingFields {
  id: string;
  dates: string;
  /** The printed left side: title, organization, and location (`formatEntryHeading`). */
  heading: string;
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
    organization: '',
    location: '',
    dates: '',
    heading: '',
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

          const fields = {
            title: trim(entry.title),
            organization: trim(entry.organization),
            location: trim(entry.location),
          };
          const heading = formatEntryHeading(fields);
          const dates = trim(entry.dates);
          const bullets = entry.bullets
            .filter((bullet) => bullet.selected)
            .map((bullet) => trim(bullet.text))
            .filter(Boolean);

          if (!heading && !dates && bullets.length === 0) {
            return null;
          }

          return {
            id: entry.id,
            ...fields,
            dates,
            heading,
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
