import { formatEntryHeading, type EntryHeadingFields } from '@shared/resume/entryHeading';
import type { ResumeSection, SectionKind, SectionLayout } from '@shared/types/resume';

export interface PrintableBullet {
  id: string;
  text: string;
}

export interface PrintableEntry extends EntryHeadingFields {
  id: string;
  dates: string;
  /** The printed left side: title, organization, and location (`formatEntryHeading`). */
  heading: string;
  /** A text-only entry's line; empty in an entry with a heading. */
  text: string;
  bullets: PrintableBullet[];
}

export interface PrintableSection {
  id: string;
  kind: SectionKind;
  layout: SectionLayout;
  label: string;
  entries: PrintableEntry[];
}

/**
 * Hidden sections, unpicked entries and bullets are kept in the resume either way; this only
 * says whether they print.
 */
export interface PrintableContentOptions {
  includeHidden?: boolean;
}

const trim = (value: string | undefined) => (value ?? '').trim();

/**
 * What the page prints, for the preview and every export alike: shown sections in order,
 * picked entries and bullets, trimmed, with anything left empty dropped.
 */
export function selectPrintableSections(
  sections: ResumeSection[],
  { includeHidden = false }: PrintableContentOptions = {}
): PrintableSection[] {
  return sections
    .filter((section) => includeHidden || !section.hidden)
    .sort((a, b) => a.order - b.order)
    .map((section) => ({
      id: section.id,
      kind: section.kind,
      layout: section.layout,
      label: trim(section.label),
      entries: section.items
        .filter((entry) => includeHidden || entry.selected)
        .map((entry): PrintableEntry | null => {
          if (section.layout === 'lines') {
            const text = trim(entry.text);
            if (!text) return null;
            const blank = { title: '', organization: '', location: '', dates: '', heading: '' };
            return { id: entry.id, ...blank, text, bullets: [] };
          }
          const fields = {
            title: trim(entry.title),
            organization: trim(entry.organization),
            location: trim(entry.location),
          };
          const heading = formatEntryHeading(fields);
          const dates = trim(entry.dates);
          const bullets = entry.bullets
            .filter((bullet) => includeHidden || bullet.selected)
            .map((bullet) => ({ id: bullet.id, text: trim(bullet.text) }))
            .filter((bullet) => bullet.text);
          if (!heading && !dates && bullets.length === 0) return null;
          return { id: entry.id, ...fields, dates, heading, text: '', bullets };
        })
        .filter((entry) => entry !== null),
    }))
    .filter((section) => section.entries.length > 0);
}
