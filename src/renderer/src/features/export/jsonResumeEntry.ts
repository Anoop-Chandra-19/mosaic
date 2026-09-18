/**
 * How a Mosaic entry maps to a JSON Resume item and back. Mosaic writes an entry the
 * Headless way — "Engineer at Acme, Detroit" over "Jan 2021 to Current" — and JSON Resume
 * has a field for each part, so the title splits into position, company, and location and
 * the subtitle into ISO dates. A title splits only where joining the parts gives it back
 * as it was. A subtitle that isn't dates has no field in work or education; the export
 * records it, with any other text the fields don't give back, in `meta.mosaic`.
 */

/** The arrays an entry can go in. */
export type ItemSource = 'work' | 'education' | 'projects' | 'skills' | 'certificates';

/** One item of a section array. Its fields depend on the array. */
export type JsonResumeItem = Record<string, string | string[]>;

/** What the page shows of an entry — for a list item, its text is the title. */
export interface EntryParts {
  title: string;
  subtitle: string;
  bullets: string[];
}

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

/** A subtitle's end when it hasn't ended. */
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
 * A subtitle's dates, when it is a date ("2025": when it ended) or a range of two ("Jan
 * 2021 to Current"); null when it is anything else.
 */
export function datesOf(subtitle: string): { startDate?: string; endDate?: string } | null {
  const text = subtitle.trim();
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

/** "Engineer at Acme, Detroit" — whichever parts there are. */
export function atPlace(what: string, ...where: string[]): string {
  const place = where.filter(Boolean).join(', ');
  return what && place ? `${what} at ${place}` : what || place;
}

/** "M.S. in Physics from MIT" — whichever parts there are. */
export function degree(studyType: string, area: string, institution: string): string {
  const field = [studyType, area].filter(Boolean).join(' in ');
  return field && institution ? `${field} from ${institution}` : field || institution;
}

/** A job's title as position, company, and location, where they join back to it. */
function workTitle(title: string): JsonResumeItem {
  const at = title.indexOf(' at ');
  if (at > 0) {
    const position = title.slice(0, at);
    const place = title.slice(at + ' at '.length);
    const comma = place.indexOf(', ');
    const name = comma < 0 ? place : place.slice(0, comma);
    const location = comma < 0 ? '' : place.slice(comma + ', '.length);
    if (atPlace(position, name, location) === title) return itemOf({ position, name, location });
  }
  return itemOf({ position: title });
}

/** A degree's title as its type, field, and school, where they join back to it. */
function educationTitle(title: string): JsonResumeItem {
  const from = title.indexOf(' from ');
  if (from > 0) {
    const field = title.slice(0, from);
    const institution = title.slice(from + ' from '.length);
    const inAt = field.indexOf(' in ');
    const studyType = inAt > 0 ? field.slice(0, inAt) : '';
    const area = inAt > 0 ? field.slice(inAt + ' in '.length) : field;
    if (degree(studyType, area, institution) === title) {
      return itemOf({ studyType, area, institution });
    }
  }
  return itemOf({ area: title });
}

/** An entry as an item of `source`. `type` names a project's section, when it has one. */
export function toItem(source: ItemSource, entry: EntryParts, type?: string): JsonResumeItem {
  const { title, subtitle, bullets } = entry;
  const dates = datesOf(subtitle);
  switch (source) {
    case 'work':
      return itemOf({ ...workTitle(title), ...dates, highlights: bullets });
    case 'education':
      return itemOf({ ...educationTitle(title), ...dates, courses: bullets });
    case 'projects':
      return itemOf({
        name: title,
        ...(dates ?? { description: subtitle }),
        highlights: bullets,
        type,
      });
    case 'skills':
      return itemOf({ name: title, level: subtitle, keywords: bullets });
    case 'certificates': {
      // One date is when it was earned; anything else says who gave it.
      const date = dates && !dates.startDate ? dates.endDate : undefined;
      return itemOf(date ? { name: title, date } : { name: title, issuer: subtitle });
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

/** An item of `source` as the entry `toItem` made it from: the parts joined back up. */
export function fromItem(source: ItemSource, item: Record<string, unknown>): EntryParts {
  const dates = when(field(item, 'startDate'), field(item, 'endDate'));
  switch (source) {
    case 'work':
      return {
        title: atPlace(field(item, 'position'), field(item, 'name'), field(item, 'location')),
        subtitle: dates,
        bullets: list(item, 'highlights'),
      };
    case 'education':
      return {
        title: degree(field(item, 'studyType'), field(item, 'area'), field(item, 'institution')),
        subtitle: dates,
        bullets: list(item, 'courses'),
      };
    case 'projects':
      return {
        title: field(item, 'name'),
        subtitle: dates || field(item, 'description'),
        bullets: list(item, 'highlights'),
      };
    case 'skills':
      return {
        title: field(item, 'name'),
        subtitle: field(item, 'level'),
        bullets: list(item, 'keywords'),
      };
    case 'certificates':
      return {
        title: field(item, 'name'),
        subtitle: field(item, 'date') ? formatDate(field(item, 'date')) : field(item, 'issuer'),
        bullets: [],
      };
  }
}

/** Whether two items have the same fields with the same values. */
export function sameItem(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((key) => JSON.stringify(a[key]) === JSON.stringify(b[key]));
}
