import {
  buildJsonResumeContact,
  projectType,
  type JsonResumeSource,
  type MosaicHeader,
  type MosaicJsonResumeMeta,
} from '@/features/export/jsonResume';
import {
  atPlace,
  compact,
  degree,
  formatDate,
  fromItem,
  sameItem,
  toItem,
  when,
} from '@/features/export/jsonResumeEntry';
import {
  BUILT_IN_HEADER_KINDS,
  HEADER_ALIGNS,
  HEADER_SEPARATORS,
  LINK_STYLES,
  createHeaderItem,
  createHeaderLine,
} from '@/lib/resume/resumeHeader';
import { SECTION_PRESETS } from '@/lib/resume/sectionPresets';
import { isRecord } from '@/lib/resume/validateResume';
import type {
  BuiltInSectionKind,
  ContactInfo,
  HeaderItemKind,
  HeaderLine,
  ResumeHeader,
  ResumeEntry,
  ResumeSection,
  SectionKind,
  SectionLayout,
} from '@/types/resume';
import type { ParsedResume } from './parseResume';

type Json = Record<string, unknown>;
type MetaSection = MosaicJsonResumeMeta['sections'][number];

/** JSON Resume's section arrays, as jsonresume.org's schema (v1.0.0) names them. */
const SECTION_ARRAYS = [
  'work',
  'volunteer',
  'education',
  'awards',
  'certificates',
  'publications',
  'skills',
  'languages',
  'interests',
  'references',
  'projects',
];

const SOURCES: ReadonlySet<string> = new Set<JsonResumeSource>([
  'summary',
  'work',
  'education',
  'projects',
  'skills',
  'certificates',
]);

/** An object with `basics` or any of the standard section arrays is taken as a JSON Resume. */
export function isJsonResume(value: unknown): value is Json {
  return (
    isRecord(value) &&
    (isRecord(value.basics) || SECTION_ARRAYS.some((key) => Array.isArray(value[key])))
  );
}

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const texts = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(text).filter(Boolean) : [];
const items = (value: unknown): Json[] => (Array.isArray(value) ? value.filter(isRecord) : []);

function entryOf({
  title = '',
  subtitle = '',
  line = '',
  bullets = [],
}: {
  title?: string;
  subtitle?: string;
  line?: string;
  bullets?: string[];
}): ResumeEntry {
  const entry: ResumeEntry = {
    id: crypto.randomUUID(),
    selected: true,
    bullets: bullets
      .filter(Boolean)
      .map((bullet) => ({ id: crypto.randomUUID(), text: bullet, selected: true })),
  };
  if (title) entry.title = title;
  if (subtitle) entry.subtitle = subtitle;
  if (line) entry.text = line;
  return entry;
}

const isEmpty = (entry: ResumeEntry) =>
  !entry.title && !entry.subtitle && !entry.text && entry.bullets.length === 0;

function sectionOf(
  kind: SectionKind,
  layout: SectionLayout,
  label: string,
  entries: ResumeEntry[]
): ResumeSection {
  return { id: crypto.randomUUID(), kind, layout, label, order: 0, items: entries };
}

/** A profile's kind, and where its address is when the file gives only a username. */
const PROFILE_SITES: { network: RegExp; kind: HeaderItemKind; site: string }[] = [
  { network: /linkedin/i, kind: 'linkedin', site: 'linkedin.com/in' },
  { network: /github/i, kind: 'github', site: 'github.com' },
];

/**
 * The header from `basics`, links as the file writes them — Mosaic prints them as they are:
 * how to reach the person on one line, where they are on the next.
 */
function headerOfBasics(basics: Json): HeaderLine[] {
  const linked = (kind: HeaderItemKind, value: string) =>
    value ? [createHeaderItem(kind, { text: value, url: value })] : [];
  const profiles = items(basics.profiles).flatMap((profile) => {
    const known = PROFILE_SITES.find(({ network }) => network.test(text(profile.network)));
    const username = text(profile.username);
    const address = text(profile.url) || (known && username ? `${known.site}/${username}` : '');
    return linked(known?.kind ?? 'custom', address);
  });
  const location = isRecord(basics.location) ? basics.location : {};
  const place =
    text(location.address) ||
    [text(location.city), text(location.region)].filter(Boolean).join(', ');
  return [
    [
      ...linked('phone', text(basics.phone)),
      ...linked('email', text(basics.email)),
      ...profiles,
      ...linked('site', text(basics.url)),
    ],
    place ? [createHeaderItem('location', { text: place })] : [],
  ]
    .filter((line) => line.length > 0)
    .map((line) => createHeaderLine(line));
}

/**
 * The header as Mosaic wrote it, or null when `basics` no longer says what the export wrote
 * there for it — another tool changed the person's details.
 */
function restoreHeaderIfUnchanged(basics: Json, header: MosaicHeader): ResumeHeader | null {
  const written = buildJsonResumeContact(header.lines);
  const location = isRecord(basics.location) ? basics.location : undefined;
  const now = compact({
    email: text(basics.email),
    phone: text(basics.phone),
    url: text(basics.url),
    location: location && { ...location },
    profiles: items(basics.profiles),
  });
  if (JSON.stringify(now) !== JSON.stringify(written)) return null;
  return {
    linkStyle: header.linkStyle,
    lines: header.lines.map(({ separator, align, items: lineItems }) =>
      createHeaderLine(
        lineItems.map(({ kind, text: shown, url }) => createHeaderItem(kind, { text: shown, url })),
        { separator, align }
      )
    ),
  };
}

// ── Mosaic's own export: `meta.mosaic` puts the sections back exactly ──

/** `exact`: by item place, a title or subtitle as text. */
function isExact(value: unknown): boolean {
  return (
    isRecord(value) &&
    Object.values(value).every(
      (parts) =>
        isRecord(parts) &&
        Object.entries(parts).every(
          ([key, part]) => (key === 'title' || key === 'subtitle') && typeof part === 'string'
        )
    )
  );
}

function metaSection(value: unknown): MetaSection | null {
  if (!isRecord(value)) return null;
  const { kind, layout, label, from, count, exact } = value;
  const known =
    kind === 'custom' || (typeof kind === 'string' && Object.hasOwn(SECTION_PRESETS, kind));
  if (!known || (layout !== 'lines' && layout !== 'entries')) return null;
  if (typeof label !== 'string' || typeof from !== 'string' || !SOURCES.has(from)) return null;
  if (!Number.isInteger(count) || (count as number) < 0) return null;
  if (exact !== undefined && !isExact(exact)) return null;
  return value as unknown as MetaSection;
}

const HEADER_KIND_IDS: ReadonlySet<string> = new Set([...BUILT_IN_HEADER_KINDS, 'custom']);
const isIn = (value: unknown, allowed: { value: string }[]) =>
  allowed.some((option) => option.value === value);

/** `header`: lines of items, each part one Mosaic knows. */
function isMetaHeader(value: unknown): value is MosaicHeader {
  return (
    isRecord(value) &&
    isIn(value.linkStyle, LINK_STYLES) &&
    Array.isArray(value.lines) &&
    value.lines.every(
      (line) =>
        isRecord(line) &&
        isIn(line.separator, HEADER_SEPARATORS) &&
        isIn(line.align, HEADER_ALIGNS) &&
        Array.isArray(line.items) &&
        line.items.every(
          (item) =>
            isRecord(item) &&
            typeof item.kind === 'string' &&
            HEADER_KIND_IDS.has(item.kind) &&
            typeof item.text === 'string' &&
            typeof item.url === 'string'
        )
    )
  );
}

function readMeta(resume: Json): MosaicJsonResumeMeta | null {
  const meta = isRecord(resume.meta) ? resume.meta.mosaic : undefined;
  if (!isRecord(meta) || meta.version !== 1 || !Array.isArray(meta.sections)) return null;
  const sections = meta.sections.map(metaSection);
  if (sections.some((section) => section === null)) return null;
  if (meta.header !== undefined && !isMetaHeader(meta.header)) return null;
  return {
    version: 1,
    ...(meta.header !== undefined && { header: meta.header as MosaicHeader }),
    sections: sections as MetaSection[],
  };
}

/**
 * The sections as Mosaic wrote them, or null when the file no longer agrees with its
 * `meta.mosaic` — another tool added or removed items — so the standard fields are read
 * as any other JSON Resume's are.
 */
function ownSections(resume: Json, meta: MosaicJsonResumeMeta): ResumeSection[] | null {
  const summary = text(isRecord(resume.basics) ? resume.basics.summary : '');
  const queues: Record<JsonResumeSource, unknown[]> = {
    summary: summary ? summary.split('\n\n') : [],
    work: items(resume.work),
    education: items(resume.education),
    projects: items(resume.projects),
    skills: items(resume.skills),
    certificates: items(resume.certificates),
  };
  for (const source of SOURCES) {
    const wanted = meta.sections
      .filter((section) => section.from === source)
      .reduce((sum, section) => sum + section.count, 0);
    if (wanted !== queues[source as JsonResumeSource].length) return null;
  }

  const taken: Partial<Record<JsonResumeSource, number>> = {};
  const sections: ResumeSection[] = [];
  for (const { kind, layout, label, from, count, exact } of meta.sections) {
    const start = taken[from] ?? 0;
    taken[from] = start + count;
    const slice = queues[from].slice(start, start + count);
    const read = ({
      title,
      subtitle,
      bullets,
    }: {
      title: string;
      subtitle: string;
      bullets: string[];
    }) => (layout === 'lines' ? entryOf({ line: title }) : entryOf({ title, subtitle, bullets }));

    if (from === 'summary') {
      const entries = (slice as string[]).map((line) =>
        read({ title: line, subtitle: '', bullets: [] })
      );
      sections.push(sectionOf(kind, layout, label, entries));
      continue;
    }
    // A project item names the section it came from, unless it came from Projects itself.
    const type = projectType(kind, label);
    if (from === 'projects' && slice.some((item) => text((item as Json).type) !== (type ?? ''))) {
      return null;
    }
    const entries = (slice as Json[]).map((item, index) => {
      const back = fromItem(from, item);
      const kept = exact?.[index];
      if (!kept) return read(back);
      // The text as it was, while the item's fields are still what the export wrote for it.
      const asWritten = { ...back, ...kept };
      return read(sameItem(toItem(from, asWritten, type), item) ? asWritten : back);
    });
    sections.push(sectionOf(kind, layout, label, entries));
  }
  return sections;
}

// ── Any other JSON Resume: entries in the Headless line — what and where, then when ──

const joined = (...parts: string[]) => parts.filter(Boolean).join(', ');
const capitalized = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/** "Languages: TypeScript, Go" — a name and its keywords. */
function withKeywords(item: Json): string {
  const keywords = texts(item.keywords).join(', ');
  const name = text(item.name);
  return name && keywords ? `${name}: ${keywords}` : name || keywords;
}

const dates = (item: Json) => when(text(item.startDate), text(item.endDate));

const roleEntry = (item: Json, role: string, where: string) =>
  entryOf({
    title: atPlace(text(item[role]), text(item[where]), text(item.location)),
    subtitle: dates(item),
    bullets: [text(item.summary), ...texts(item.highlights)],
  });

const projectEntry = (item: Json) =>
  entryOf({
    title: text(item.name),
    subtitle: dates(item),
    bullets: [text(item.description), ...texts(item.highlights)],
  });

function educationEntry(item: Json): ResumeEntry {
  const score = text(item.score);
  return entryOf({
    title: degree(text(item.studyType), text(item.area), text(item.institution)),
    subtitle: dates(item),
    bullets: [...texts(item.courses), score && !/gpa/i.test(score) ? `GPA: ${score}` : score],
  });
}

const preset = (kind: BuiltInSectionKind, entries: ResumeEntry[]) =>
  sectionOf(kind, SECTION_PRESETS[kind].layout, SECTION_PRESETS[kind].label, entries);

const customList = (label: string, lines: string[]) =>
  sectionOf(
    'custom',
    'lines',
    label,
    lines.map((line) => entryOf({ line }))
  );

const customSection = (label: string, entries: ResumeEntry[]) =>
  sectionOf('custom', 'entries', label, entries);

/** Projects by `type`: untyped ones are Projects; each type is a section of that name. */
function projectSections(projects: Json[]): ResumeSection[] {
  const byType = new Map<string, Json[]>();
  for (const project of projects) {
    const type = text(project.type);
    byType.set(type, [...(byType.get(type) ?? []), project]);
  }
  return [...byType].map(([type, group]) => {
    const entries = group.map(projectEntry);
    if (!type) return preset('projects', entries);
    // A type whose items are only names is a list.
    const namesOnly = entries.every((entry) => !entry.subtitle && entry.bullets.length === 0);
    return namesOnly
      ? customList(
          capitalized(type),
          group.map((item) => text(item.name))
        )
      : customSection(capitalized(type), entries);
  });
}

/** An award or a publication: what and from whom, its date, and a line about it. */
const noteEntry = (item: Json, what: string, from: string, date: string) =>
  entryOf({
    title: joined(text(item[what]), text(item[from])),
    subtitle: formatDate(text(item[date])),
    bullets: [text(item.summary)],
  });

/** The sections a standard field makes, in the order the file has them. */
function standardSections(resume: Json): ResumeSection[] {
  return Object.entries(resume).flatMap(([key, value]): ResumeSection[] => {
    switch (key) {
      case 'basics': {
        const summary = isRecord(value) ? text(value.summary) : '';
        const paragraphs = summary.split(/\n\s*\n/).map((paragraph) => paragraph.trim());
        return [
          preset(
            'summary',
            paragraphs.map((line) => entryOf({ line }))
          ),
        ];
      }
      case 'work':
        return [
          preset(
            'experience',
            items(value).map((item) => roleEntry(item, 'position', 'name'))
          ),
        ];
      case 'volunteer':
        return [
          customSection(
            'Volunteering',
            items(value).map((item) => roleEntry(item, 'position', 'organization'))
          ),
        ];
      case 'education':
        return [preset('education', items(value).map(educationEntry))];
      case 'projects':
        return projectSections(items(value));
      case 'skills':
        return [
          preset(
            'skills',
            items(value).map((item) => entryOf({ line: withKeywords(item) }))
          ),
        ];
      case 'certificates':
        return [
          preset(
            'certifications',
            items(value).map((item) =>
              entryOf({
                title: joined(text(item.name), text(item.issuer)),
                subtitle: formatDate(text(item.date)),
              })
            )
          ),
        ];
      case 'awards':
        return [
          customSection(
            'Awards',
            items(value).map((item) => noteEntry(item, 'title', 'awarder', 'date'))
          ),
        ];
      case 'publications':
        return [
          customSection(
            'Publications',
            items(value).map((item) => noteEntry(item, 'name', 'publisher', 'releaseDate'))
          ),
        ];
      case 'languages':
        return [
          customList(
            'Languages',
            items(value).map((item) =>
              [text(item.language), text(item.fluency)].filter(Boolean).join(' — ')
            )
          ),
        ];
      case 'interests':
        return [customList('Interests', items(value).map(withKeywords))];
      default:
        return [];
    }
  });
}

/** What a JSON Resume has that Mosaic has no place for: a headline, references. */
function leftOutOf(resume: Json): string[] {
  const basics = isRecord(resume.basics) ? resume.basics : {};
  const references = items(resume.references).map((item) =>
    [text(item.name), text(item.reference)].filter(Boolean).join(': ')
  );
  return [text(basics.label), ...references].filter(Boolean);
}

/**
 * A JSON Resume file as a resume to review. Mosaic's own export comes back exactly, through
 * `meta.mosaic`; any other file is read from its standard fields, each array into the
 * section it means, entries written the Headless way.
 */
export function readJsonResume(resume: Json): ParsedResume {
  const basics = isRecord(resume.basics) ? resume.basics : {};
  const meta = readMeta(resume);
  const own = meta ? ownSections(resume, meta) : null;
  const warnings: string[] = [];

  const sections = (own ?? standardSections(resume))
    .map((section) => ({ ...section, items: section.items.filter((item) => !isEmpty(item)) }))
    .filter((section) => section.items.length > 0)
    .map((section, order) => ({ ...section, order }));
  const headerAsWritten = meta?.header ? restoreHeaderIfUnchanged(basics, meta.header) : null;
  const contact: ContactInfo = {
    name: text(basics.name),
    header: headerAsWritten ?? { linkStyle: 'plain', lines: headerOfBasics(basics) },
  };

  if (meta && !own) {
    warnings.push(
      'This file was changed after Mosaic exported it, so its sections are read by their JSON Resume names.'
    );
  }
  if (meta?.header && !headerAsWritten) {
    warnings.push(
      'The contact details in this file were changed after Mosaic exported it, so the header is built from them.'
    );
  }
  if (sections.length === 0) warnings.push('This file has no sections Mosaic can read.');
  if (!contact.name) warnings.push('This file has no name — add it after importing.');

  return {
    resume: { schemaVersion: 1, contact, sections },
    warnings,
    leftOut: leftOutOf(resume),
  };
}
