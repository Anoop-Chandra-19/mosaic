import type { LinkColor, LinkStyle, ResumeData } from '@shared/types/resume';
import { getPrintableHeaderLines, type PrintedHeaderLine } from '@shared/resume/resumeHeader';
import {
  selectPrintableSections,
  type PrintableContentOptions,
  type PrintableEntry,
  type PrintableSection,
} from '@/lib/resume/selectPrintableSections';

/** Bullets as their text alone: no format writes their ids. */
export interface ExportEntry extends Omit<PrintableEntry, 'bullets'> {
  bullets: string[];
}

export interface ExportSection extends Omit<PrintableSection, 'entries'> {
  entries: ExportEntry[];
}

/** The top of the page as it prints: the name, and the header's printed lines. */
export interface ExportContact {
  name: string;
  linkStyle: LinkStyle;
  linkColor: LinkColor;
  lines: PrintedHeaderLine[];
}

export interface NormalizedResumeExport {
  contact: ExportContact;
  sections: ExportSection[];
}

/**
 * What an export holds: what the page shows, or everything the resume holds. Hidden header
 * items, like hidden sections, entries, and bullets, are kept either way.
 */
export type ExportContentOptions = PrintableContentOptions;

export function normalizeResumeForExport(
  resume: ResumeData,
  { includeHidden = false }: ExportContentOptions = {}
): NormalizedResumeExport {
  const sections = selectPrintableSections(resume.sections, { includeHidden }).map(
    (section): ExportSection => ({
      ...section,
      entries: section.entries.map((entry) => ({
        ...entry,
        bullets: entry.bullets.map((bullet) => bullet.text),
      })),
    })
  );

  const { name, header } = resume.contact;
  return {
    contact: {
      name: name.trim(),
      linkStyle: header.linkStyle,
      linkColor: header.linkColor ?? 'ink',
      lines: getPrintableHeaderLines(header, { includeHidden }),
    },
    sections,
  };
}
