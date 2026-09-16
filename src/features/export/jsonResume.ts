import type { SectionKind, SectionLayout } from '@/types/resume';
import {
  compact,
  fromItem,
  toItem,
  type EntryParts,
  type ItemSource,
  type JsonResumeItem,
} from './jsonResumeEntry';
import type { ExportEntry, ExportSection, NormalizedResumeExport } from './normalizeResumeExport';

/**
 * Minimal subset of the JSON Resume schema (jsonresume.org, v1.0.0). Every field is
 * optional upstream, so a conservative mapping is always valid. Entries go into the fields
 * that mean their parts — `jsonResumeEntry.ts` — and `meta.mosaic` keeps what those
 * fields can't say, so Mosaic reads its own file back exactly.
 */
interface JsonResumeProfile {
  network: string;
  url: string;
}

interface JsonResumeBasics {
  name?: string;
  email?: string;
  phone?: string;
  url?: string;
  summary?: string;
  location?: { address?: string };
  profiles?: JsonResumeProfile[];
}

/** Where a section's content goes: one of JSON Resume's arrays, or `basics.summary`. */
export type JsonResumeSource = 'summary' | ItemSource;

/**
 * `meta.mosaic` — JSON Resume's `meta` is the standard's place for a tool's own data. It
 * says how the standard fields go back together: each section's kind, shape, and heading,
 * in order, and how many items it put in which array (a section's items sit together
 * there). Other tools ignore it.
 */
export interface MosaicJsonResumeMeta {
  version: 1;
  /** The contact's work authorization, which JSON Resume has no field for. */
  workStatus?: string;
  sections: {
    kind: SectionKind;
    layout: SectionLayout;
    label: string;
    from: JsonResumeSource;
    count: number;
    /**
     * By the item's place in the section: its title or subtitle where the item's fields
     * don't give it back as it was — "January 2021 to Present" reads back from ISO dates as
     * "Jan 2021 to Current", and a work subtitle that isn't dates has no field at all.
     */
    exact?: Record<string, Partial<Pick<EntryParts, 'title' | 'subtitle'>>>;
  }[];
}

interface JsonResume {
  $schema: string;
  basics?: JsonResumeBasics;
  work?: JsonResumeItem[];
  education?: JsonResumeItem[];
  projects?: JsonResumeItem[];
  skills?: JsonResumeItem[];
  certificates?: JsonResumeItem[];
  meta: { mosaic: MosaicJsonResumeMeta };
}

/** An entry's one line of text: a lines-section item, or an entry's title. */
function lineText(entry: ExportEntry): string {
  return entry.text || entry.title;
}

/**
 * The array a section's entries go in, by what the section is — or `projects`, which holds
 * any section under its own name, when the kind's own place can't hold what it has.
 */
function sourceOf({ kind, layout, entries }: ExportSection): JsonResumeSource {
  switch (kind) {
    case 'summary':
      // basics.summary is one piece of text: room for lines, not titles and bullets.
      return layout === 'lines' ? 'summary' : 'projects';
    case 'experience':
    case 'internships':
      return 'work';
    case 'education':
      return 'education';
    case 'skills':
      return 'skills';
    case 'certifications':
      // A certificate has no field for bullets.
      return entries.some((entry) => entry.bullets.length > 0) ? 'projects' : 'certificates';
    case 'projects':
    case 'custom':
      return 'projects';
  }
}

/** The name a project item gives its section: JSON Resume has no sections of your own. */
export function projectType(kind: SectionKind, label: string): string | undefined {
  return kind === 'projects' ? undefined : label;
}

function buildBasics(data: NormalizedResumeExport, summary: string[]): JsonResumeBasics {
  const { contact } = data;

  const profiles: JsonResumeProfile[] = [];
  if (contact.linkedin) profiles.push({ network: 'LinkedIn', url: contact.linkedin });
  if (contact.github) profiles.push({ network: 'GitHub', url: contact.github });

  return compact({
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    url: contact.website,
    summary: summary.join('\n\n'),
    // Mosaic's location is freeform; JSON Resume's is structured. The whole
    // string goes to `address` rather than guessing at city/region splits.
    location: contact.location ? { address: contact.location } : undefined,
    profiles,
  });
}

export function createJsonResumeExport(data: NormalizedResumeExport): string {
  const summary: string[] = [];
  const arrays: Record<ItemSource, JsonResumeItem[]> = {
    work: [],
    education: [],
    projects: [],
    skills: [],
    certificates: [],
  };
  const sections: MosaicJsonResumeMeta['sections'] = [];

  for (const section of data.sections) {
    const from = sourceOf(section);
    const { kind, layout, label } = section;
    const exact: NonNullable<MosaicJsonResumeMeta['sections'][number]['exact']> = {};
    if (from === 'summary') {
      summary.push(...section.entries.map(lineText));
    } else {
      section.entries.forEach((entry, index) => {
        const parts = { title: lineText(entry), subtitle: entry.subtitle, bullets: entry.bullets };
        const item = toItem(from, parts, projectType(kind, label));
        arrays[from].push(item);
        const back = fromItem(from, item);
        const differs: (typeof exact)[string] = {};
        if (back.title !== parts.title) differs.title = parts.title;
        if (back.subtitle !== parts.subtitle) differs.subtitle = parts.subtitle;
        if (Object.keys(differs).length > 0) exact[index] = differs;
      });
    }
    sections.push({
      kind,
      layout,
      label,
      from,
      count: section.entries.length,
      ...(Object.keys(exact).length > 0 && { exact }),
    });
  }

  const resume: JsonResume = compact({
    $schema: 'https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json',
    basics: buildBasics(data, summary),
    ...arrays,
    meta: {
      mosaic: {
        version: 1,
        ...(data.contact.citizenshipStatus && { workStatus: data.contact.citizenshipStatus }),
        sections,
      },
    },
  });

  return JSON.stringify(resume, null, 2);
}
