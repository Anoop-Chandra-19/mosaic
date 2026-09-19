/**
 * How a Mosaic entry maps to a JSON Resume item and back. Each of an entry's parts goes in
 * the field that means it — a job's title is its position, its organization the company —
 * and its dates become ISO dates where they read as dates. A degree's title splits into its
 * type and field only where joining them gives it back as it was. What an item has no field
 * for — a school's location, dates that aren't dates — the export records in `meta.mosaic`.
 */

import type { EntryHeadingFields } from '@shared/resume/entryHeading';

/** The arrays an entry can go in. */
export type ItemSource = 'work' | 'education' | 'projects' | 'skills' | 'certificates';

/** One item of a section array. Its fields depend on the array. */
export type JsonResumeItem = Record<string, string | string[]>;

/** An entry's parts — for a list item, its text is the title. */
export interface EntryParts extends EntryHeadingFields {
  dates: string;
  bullets: string[];
}

/** The parts of an entry that are text, which `meta.mosaic` can keep as written. */
export const ENTRY_TEXT_PARTS = ['title', 'organization', 'location', 'dates'] as const;

export type EntryTextPart = (typeof ENTRY_TEXT_PARTS)[number];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_NAMES = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

/** A range's end when it hasn't ended. */
const ONGOING = /^(?:current|present|now|ongoing|today)$/i;
/** Between a range's two dates: "to", or a dash. */
const RANGE = /\s+(?:to|through|until|[–—-])\s+|\s*[–—]\s*/i;

/** Strip empty strings, undefined values, and empty arrays from an object. */
export function compact<T extends object>(value: T): T {
  const result = {} as T;
  for (const [key, entry] of Object.entries(value)) {
    if (entry === undefined || entry === '') continue;
    if (Array.isArray(entry) && entry.length === 0) continue;
    result[key as keyof T] = entry as T[keyof T];
  }
  return result;
}

/** An item with only the fields that have something in them. */
const itemOf = (fields: Record<string, string | string[] | undefined>) =>
  compact(fields) as JsonResumeItem;

const twoDigits = (n: number) => String(n).padStart(2, '0');

/** "Jan 2021", "January 2021", "01/2021", "2021-01", or "2021" as an ISO date; else null. */
function isoDate(text: string): string | null {
  const value = text.trim();
  if (/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(value)) return value;
  const numeric = /^(\d{1,2})\/(\d{4})$/.exec(value);
  if (numeric && Number(numeric[1]) >= 1 && Number(numeric[1]) <= 12) {
    return `${numeric[2]}-${twoDigits(Number(numeric[1]))}`;
  }
  const named = /^([a-z]{3,})\.?,?\s+(\d{4})$/i.exec(value);
  const month = named
    ? MONTH_NAMES.findIndex((name) => name.startsWith(named[1].toLowerCase()))
    : -1;
  return named && month >= 0 ? `${named[2]}-${twoDigits(month + 1)}` : null;
}

/**
 * An entry's dates as ISO dates, when they are a date ("2025": when it ended) or a range of
 * two ("Jan 2021 to Current"); null when they are anything else.
 */
export function datesOf(dates: string): { startDate?: string; endDate?: string } | null {
  const text = dates.trim();
  if (!text) return null;
  const single = isoDate(text);
  if (single) return { endDate: single };
  const years = /^(\d{4})-(\d{4})$/.exec(text);
  const parts = years ? [years[1], years[2]] : text.split(RANGE);
  if (parts.length !== 2) return null;
  const start = isoDate(parts[0]);
  if (!start) return null;
  if (ONGOING.test(parts[1].trim())) return { startDate: start };
  const end = isoDate(parts[1]);
  return end ? { startDate: start, endDate: end } : null;
}

/** An ISO date as the Headless format writes it — "Jan 2021", or "2021" — else as it is. */
export function formatDate(value: string): string {
  const match = /^(\d{4})(?:-(\d{2}))?/.exec(value);
  if (!match) return value;
  const month = match[2] ? MONTHS[Number(match[2]) - 1] : undefined;
  return month ? `${month} ${match[1]}` : match[1];
}

/** "Jan 2021 to Mar 2023"; a start with no end is still going. */
export function when(start: string, end: string): string {
  const from = formatDate(start);
  const to = formatDate(end);
  if (from && to) return `${from} to ${to}`;
  return from ? `${from} to Current` : to;
}

/** "M.S. in Physics" — whichever parts there are. */
export function degree(studyType: string, area: string): string {
  return [studyType, area].filter(Boolean).join(' in ');
}

/** A degree's title as its type and field, where they join back to it. */
function degreeFields(title: string): JsonResumeItem {
  const inAt = title.indexOf(' in ');
  const studyType = inAt > 0 ? title.slice(0, inAt) : '';
  const area = inAt > 0 ? title.slice(inAt + ' in '.length) : title;
  return itemOf(degree(studyType, area) === title ? { studyType, area } : { area: title });
}

/** An entry as an item of `source`. `type` names a project's section, when it has one. */
export function toItem(source: ItemSource, entry: EntryParts, type?: string): JsonResumeItem {
  const { title, organization, location, bullets } = entry;
  const dates = datesOf(entry.dates);
  switch (source) {
    case 'work':
      return itemOf({
        position: title,
        name: organization,
        location,
        ...dates,
        highlights: bullets,
      });
    case 'education':
      return itemOf({
        ...degreeFields(title),
        institution: organization,
        ...dates,
        courses: bullets,
      });
    case 'projects':
      return itemOf({
        name: title,
        entity: organization,
        ...(dates ?? { description: entry.dates }),
        highlights: bullets,
        type,
      });
    case 'skills':
      return itemOf({ name: title, level: entry.dates, keywords: bullets });
    case 'certificates': {
      // One date is when it was earned.
      const date = dates && !dates.startDate ? dates.endDate : undefined;
      return itemOf({ name: title, issuer: organization, date });
    }
  }
}

const field = (item: Record<string, unknown>, key: string) =>
  typeof item[key] === 'string' ? (item[key] as string).trim() : '';
const list = (item: Record<string, unknown>, key: string) =>
  Array.isArray(item[key])
    ? (item[key] as unknown[]).flatMap((value) =>
        typeof value === 'string' && value.trim() ? [value.trim()] : []
      )
    : [];

/** An item of `source` as the entry `toItem` made it from. */
export function fromItem(source: ItemSource, item: Record<string, unknown>): EntryParts {
  const dates = when(field(item, 'startDate'), field(item, 'endDate'));
  const parts = (
    title: string,
    organization: string,
    rest: Partial<EntryParts> & { bullets: string[] }
  ): EntryParts => ({ title, organization, location: '', dates, ...rest });
  switch (source) {
    case 'work':
      return parts(field(item, 'position'), field(item, 'name'), {
        location: field(item, 'location'),
        bullets: list(item, 'highlights'),
      });
    case 'education':
      return parts(
        degree(field(item, 'studyType'), field(item, 'area')),
        field(item, 'institution'),
        {
          bullets: list(item, 'courses'),
        }
      );
    case 'projects':
      return parts(field(item, 'name'), field(item, 'entity'), {
        dates: dates || field(item, 'description'),
        bullets: list(item, 'highlights'),
      });
    case 'skills':
      return parts(field(item, 'name'), '', {
        dates: field(item, 'level'),
        bullets: list(item, 'keywords'),
      });
    case 'certificates':
      return parts(field(item, 'name'), field(item, 'issuer'), {
        dates: formatDate(field(item, 'date')),
        bullets: [],
      });
  }
}

/** Whether two items have the same fields with the same values. */
export function sameItem(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((key) => JSON.stringify(a[key]) === JSON.stringify(b[key]));
}
