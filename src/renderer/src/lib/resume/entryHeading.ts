/**
 * An entry's printed line: its title, organization, and location on the left — "Analyst,
 * Babbage & Co, London" — and its dates on the right. Every format that only has the
 * printed line (plain text, PDF, DOCX, Markdown) writes this, and reads it back with
 * `splitEntryHeading`.
 */

export interface EntryHeadingFields {
  title: string;
  organization: string;
  location: string;
}

/** Between the parts of an entry's line. */
export const ENTRY_HEADING_SEPARATOR = ', ';

/** "Analyst, Babbage & Co, London" — whichever parts there are. */
export function formatEntryHeading({
  title,
  organization,
  location,
}: Partial<Record<keyof EntryHeadingFields, string>>): string {
  return [title, organization, location]
    .map((part) => (part ?? '').trim())
    .filter(Boolean)
    .join(ENTRY_HEADING_SEPARATOR);
}

/**
 * A printed line as its fields: the first part is the title, the second the organization,
 * and the rest the location — so "Physicist, CERN, Geneva, Switzerland" keeps its place
 * whole. A title or organization that held a comma, or an entry with no title or no
 * organization, comes back with its parts a field early; the line prints the same.
 */
export function splitEntryHeading(
  heading: string,
  separator: string = ENTRY_HEADING_SEPARATOR
): EntryHeadingFields {
  const [title = '', organization = '', ...location] = heading
    .split(separator)
    .map((part) => part.trim());
  return { title, organization, location: location.filter(Boolean).join(ENTRY_HEADING_SEPARATOR) };
}
