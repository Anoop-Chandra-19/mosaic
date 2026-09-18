import type {
  HeaderAlign,
  HeaderItemKind,
  HeaderSeparator,
  LinkStyle,
  SectionKind,
  SectionLayout,
} from '@shared/types/resume';
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

/** The fields of `basics` that say how to reach the person. */
interface JsonResumeContact {
  email?: string;
  phone?: string;
  url?: string;
  location?: { address?: string };
  profiles?: JsonResumeProfile[];
}

interface JsonResumeBasics extends JsonResumeContact {
  name?: string;
  summary?: string;
}

export interface MosaicHeaderLine {
  separator: HeaderSeparator;
  align: HeaderAlign;
  items: { kind: HeaderItemKind; text: string; url: string }[];
}

/** The header as it prints, which `basics` can only say part of. */
export interface MosaicHeader {
  linkStyle: LinkStyle;
  lines: MosaicHeaderLine[];
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
  header?: MosaicHeader;
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

const PROFILE_NETWORKS: Partial<Record<HeaderItemKind, string>> = {
  linkedin: 'LinkedIn',
  github: 'GitHub',
};

/**
 * The contact fields of `basics` a header fills: the first item of each kind that has a
 * field, and every profile. Items of other kinds — a work authorization, a custom item — have
 * no field, and are only in `meta.mosaic.header`.
 */
export function buildJsonResumeContact(lines: MosaicHeaderLine[]): JsonResumeContact {
  const items = lines.flatMap((line) => line.items);
  const first = (kind: HeaderItemKind) => items.find((item) => item.kind === kind);
  const email = first('email');
  const site = first('site');
  const location = first('location');
  return compact({
    email: email && (email.url.replace(/^mailto:/i, '') || email.text),
    phone: first('phone')?.text,
    url: site && (site.url || site.text),
    // Mosaic's location is freeform; JSON Resume's is structured. The whole
    // string goes to `address` rather than guessing at city/region splits.
    location: location && { address: location.text },
    profiles: items.flatMap((item) => {
      const network = PROFILE_NETWORKS[item.kind];
      return network ? [{ network, url: item.url || item.text }] : [];
    }),
  });
}

function buildBasics(data: NormalizedResumeExport, header: MosaicHeader, summary: string[]) {
  return compact({
    name: data.contact.name,
    ...buildJsonResumeContact(header.lines),
    summary: summary.join('\n\n'),
  });
}

/** The printed header as `meta.mosaic` keeps it: each item's text and its written link. */
function mosaicHeader({ linkStyle, lines }: NormalizedResumeExport['contact']): MosaicHeader {
  return {
    linkStyle,
    lines: lines.map(({ separator, align, items }) => ({
      separator,
      align,
      items: items.map(({ kind, text, href }) => ({ kind, text, url: href })),
    })),
  };
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

  const header = mosaicHeader(data.contact);
  const resume: JsonResume = compact({
    $schema: 'https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json',
    basics: buildBasics(data, header, summary),
    ...arrays,
    meta: {
      mosaic: {
        version: 1,
        ...(header.lines.length > 0 && { header }),
        sections,
      },
    },
  });

  return JSON.stringify(resume, null, 2);
}
