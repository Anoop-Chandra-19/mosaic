import type { ContactInfo } from '@/types/resume';

export interface NormalizedContact {
  name: string;
  email: string;
  phone: string;
  location: string;
  citizenshipStatus: string;
  linkedin: string;
  github: string;
  website: string;
}

function trim(value: string | undefined) {
  return (value ?? '').trim();
}

export function normalizeContact(contact: ContactInfo): NormalizedContact {
  return {
    name: trim(contact.name),
    email: trim(contact.email),
    phone: trim(contact.phone),
    location: trim(contact.location),
    citizenshipStatus: trim(contact.citizenshipStatus),
    linkedin: contact.showLinkedin === false ? '' : trim(contact.linkedin),
    github: contact.showGithub === false ? '' : trim(contact.github),
    website: contact.showWebsite === false ? '' : trim(contact.website),
  };
}

/**
 * The Headless header is three lines: name, then contact, then status.
 *
 *   Phone | Email | LinkedIn/Portfolio
 *   Citizenship status at City, State
 *
 * Phone leads because the template puts it first. The links stay on line one
 * rather than getting a line of their own, which is what leaves line two free
 * for the status.
 */
export function getContactPrimaryLine(contact: NormalizedContact) {
  return [contact.phone, contact.email, contact.linkedin, contact.github, contact.website]
    .filter(Boolean)
    .join(' | ');
}

export function getContactSecondaryLine(contact: NormalizedContact) {
  // Pipe, not "at": the status is often a whole clause ("F-1 STEM OPT, work
  // authorized through July 2028"), which "at" reads wrong against. Pipe also
  // matches the separator the line above uses.
  return [contact.citizenshipStatus, contact.location].filter(Boolean).join(' | ');
}

/** Header lines straight from stored contact info, for the on-screen preview.
 *  Shares the builders above so the preview cannot drift from the export. */
export function getContactLines(contact: ContactInfo) {
  const normalized = normalizeContact(contact);
  return {
    primary: getContactPrimaryLine(normalized),
    secondary: getContactSecondaryLine(normalized),
  };
}
