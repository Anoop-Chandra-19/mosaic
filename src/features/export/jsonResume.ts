import type { SectionKind, SectionLayout } from '@/types/resume';
import type { ExportEntry, ExportSection, NormalizedResumeExport } from './normalizeResumeExport';

/**
 * Minimal subset of the JSON Resume schema (jsonresume.org, v1.0.0). Every
 * field is optional in the upstream schema, so a conservative mapping is
 * always valid. Mosaic-specific structure (selection flags, freeform
 * subtitles) maps losslessly where possible and is never parsed
 * heuristically — a subtitle lands whole in the closest matching field.
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

/** One item of a section array: `work`, `projects`, … Its fields depend on the array. */
type JsonResumeItem = Record<string, string | string[]>;

/** Where a section's content goes: one of JSON Resume's arrays, or `basics.summary`. */
export type JsonResumeSource =
  | 'summary'
  | 'work'
  | 'education'
  | 'projects'
  | 'skills'
  | 'certificates';

type ItemSource = Exclude<JsonResumeSource, 'summary'>;

/**
 * The field each array keeps an entry's parts in: its title (or a list item's text), its
 * subtitle, its bullets. The importer reads Mosaic's own files back through the same table.
 */
export const ENTRY_FIELDS: Record<
  ItemSource,
  { title: string; subtitle: string; bullets?: string }
> = {
  work: { title: 'position', subtitle: 'name', bullets: 'highlights' },
  education: { title: 'area', subtitle: 'institution', bullets: 'courses' },
  projects: { title: 'name', subtitle: 'description', bullets: 'highlights' },
  skills: { title: 'name', subtitle: 'level', bullets: 'keywords' },
  certificates: { title: 'name', subtitle: 'issuer' },
};

/**
 * `meta.mosaic` — JSON Resume's `meta` is the standard's place for a tool's own data. The
 * standard fields hold all of the content; this says how it goes back together: each
 * section's kind, shape, and heading, in order, and how many items it put in which array
 * (a section's items sit together there). Mosaic reads its own files back exactly with it;
 * other tools ignore it.
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

/** Strip empty strings, undefined values, and empty arrays from an object. */
function compact<T extends object>(value: T): T {
  const result = {} as T;
  for (const [key, entry] of Object.entries(value)) {
    if (entry === undefined || entry === '') continue;
    if (Array.isArray(entry) && entry.length === 0) continue;
    result[key as keyof T] = entry as T[keyof T];
  }
  return result;
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

function toItem(source: ItemSource, section: ExportSection, entry: ExportEntry): JsonResumeItem {
  const fields = ENTRY_FIELDS[source];
  const item: Record<string, string | string[] | undefined> = {
    [fields.title]: lineText(entry),
    [fields.subtitle]: entry.subtitle,
  };
  if (fields.bullets) item[fields.bullets] = entry.bullets;
  if (source === 'certificates') {
    item.date = entry.endDate ?? entry.startDate;
  } else if (source !== 'skills') {
    item.startDate = entry.startDate;
    item.endDate = entry.endDate;
  }
  // JSON Resume has no sections of your own; a project keeps the section's name.
  if (source === 'projects' && section.kind !== 'projects') item.type = section.label;
  return compact(item) as JsonResumeItem;
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
    if (from === 'summary') {
      summary.push(...section.entries.map(lineText));
    } else {
      arrays[from].push(...section.entries.map((entry) => toItem(from, section, entry)));
    }
    const { kind, layout, label } = section;
    sections.push({ kind, layout, label, from, count: section.entries.length });
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
