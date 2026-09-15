import {
  ENTRY_FIELDS,
  type JsonResumeSource,
  type MosaicJsonResumeMeta,
} from '@/features/export/jsonResume';
import { SECTION_PRESETS } from '@/lib/resume/sectionPresets';
import { isRecord } from '@/lib/resume/validateResume';
import type {
  BuiltInSectionKind,
  ContactInfo,
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
  ...(Object.keys(ENTRY_FIELDS) as JsonResumeSource[]),
]);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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

/** The contact, links as the file writes them — Mosaic prints them as they are. */
function contactOf(basics: Json, workStatus: string): ContactInfo {
  const profile = (network: RegExp, site: string) => {
    const found = items(basics.profiles).find((p) => network.test(text(p.network)));
    if (!found) return '';
    const username = text(found.username);
    return text(found.url) || (username ? `${site}/${username}` : '');
  };
  const location = isRecord(basics.location) ? basics.location : {};
  return {
    name: text(basics.name),
    email: text(basics.email),
    phone: text(basics.phone),
    location:
      text(location.address) ||
      [text(location.city), text(location.region)].filter(Boolean).join(', '),
    ...(workStatus && { citizenshipStatus: workStatus }),
    linkedin: profile(/linkedin/i, 'linkedin.com/in'),
    github: profile(/github/i, 'github.com'),
    website: text(basics.url),
    showLinkedin: true,
    showGithub: true,
    showWebsite: true,
  };
}

// ── Mosaic's own export: `meta.mosaic` puts the sections back exactly ──

function metaSection(value: unknown): MetaSection | null {
  if (!isRecord(value)) return null;
  const { kind, layout, label, from, count } = value;
  const known =
    kind === 'custom' || (typeof kind === 'string' && Object.hasOwn(SECTION_PRESETS, kind));
  if (!known || (layout !== 'lines' && layout !== 'entries')) return null;
  if (typeof label !== 'string' || typeof from !== 'string' || !SOURCES.has(from)) return null;
  if (!Number.isInteger(count) || (count as number) < 0) return null;
  return value as unknown as MetaSection;
}

function readMeta(resume: Json): MosaicJsonResumeMeta | null {
  const meta = isRecord(resume.meta) ? resume.meta.mosaic : undefined;
  if (!isRecord(meta) || meta.version !== 1 || !Array.isArray(meta.sections)) return null;
  const sections = meta.sections.map(metaSection);
  if (sections.some((section) => section === null)) return null;
  return { version: 1, workStatus: text(meta.workStatus), sections: sections as MetaSection[] };
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
  for (const { kind, layout, label, from, count } of meta.sections) {
    const start = taken[from] ?? 0;
    taken[from] = start + count;
    const slice = queues[from].slice(start, start + count);
    const read = (title: string, subtitle = '', bullets: string[] = []) =>
      layout === 'lines' ? entryOf({ line: title }) : entryOf({ title, subtitle, bullets });

    if (from === 'summary') {
      sections.push(
        sectionOf(
          kind,
          layout,
          label,
          (slice as string[]).map((s) => read(s))
        )
      );
      continue;
    }
    // A project item names the section it came from, unless it came from Projects itself.
    const type = kind === 'projects' ? '' : label.trim();
    if (from === 'projects' && slice.some((item) => text((item as Json).type) !== type)) {
      return null;
    }
    const fields = ENTRY_FIELDS[from];
    const entries = (slice as Json[]).map((item) =>
      read(
        text(item[fields.title]),
        text(item[fields.subtitle]),
        fields.bullets ? texts(item[fields.bullets]) : []
      )
    );
    sections.push(sectionOf(kind, layout, label, entries));
  }
  return sections;
}

// ── Any other JSON Resume: entries in the Headless line — what and where, then when ──

/** An ISO date as the Headless format writes it — "Jan 2021", or "2021" — else as it is. */
function formatDate(value: string): string {
  const match = /^(\d{4})(?:-(\d{2}))?/.exec(value);
  if (!match) return value;
  const month = match[2] ? MONTHS[Number(match[2]) - 1] : undefined;
  return month ? `${month} ${match[1]}` : match[1];
}

/** "Jan 2021 to Mar 2023"; a start with no end is still going. */
function when(start: unknown, end: unknown): string {
  const from = formatDate(text(start));
  const to = formatDate(text(end));
  if (from && to) return `${from} to ${to}`;
  return from ? `${from} to Current` : to;
}

/** "Engineer at Acme, Detroit" — whichever parts there are. */
function atPlace(what: string, ...where: string[]): string {
  const place = where.filter(Boolean).join(', ');
  return what && place ? `${what} at ${place}` : what || place;
}

const joined = (...parts: string[]) => parts.filter(Boolean).join(', ');
const capitalized = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/** "Languages: TypeScript, Go" — a name and its keywords. */
function withKeywords(item: Json): string {
  const keywords = texts(item.keywords).join(', ');
  const name = text(item.name);
  return name && keywords ? `${name}: ${keywords}` : name || keywords;
}

const roleEntry = (item: Json, role: string, where: string) =>
  entryOf({
    title: atPlace(text(item[role]), text(item[where]), text(item.location)),
    subtitle: when(item.startDate, item.endDate),
    bullets: [text(item.summary), ...texts(item.highlights)],
  });

const projectEntry = (item: Json) =>
  entryOf({
    title: text(item.name),
    subtitle: when(item.startDate, item.endDate),
    bullets: [text(item.description), ...texts(item.highlights)],
  });

function educationEntry(item: Json): ResumeEntry {
  const degree = [text(item.studyType), text(item.area)].filter(Boolean).join(' in ');
  const institution = text(item.institution);
  const score = text(item.score);
  return entryOf({
    title: degree && institution ? `${degree} from ${institution}` : degree || institution,
    subtitle: text(item.endDate) ? formatDate(text(item.endDate)) : when(item.startDate, ''),
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
  const contact = contactOf(basics, meta?.workStatus ?? '');

  if (meta && !own) {
    warnings.push(
      'This file was changed after Mosaic exported it, so its sections are read by their JSON Resume names.'
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
