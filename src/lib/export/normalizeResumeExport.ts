import type { ContactInfo, ResumeData, SectionType } from '@/types/resume';

const TEXT_ONLY_TYPES = new Set<SectionType>(['summary', 'skills']);

export interface ExportEntry {
  id: string;
  title: string;
  subtitle: string;
  text: string;
  bullets: string[];
}

export interface ExportSection {
  id: string;
  type: SectionType;
  label: string;
  entries: ExportEntry[];
}

export interface ExportContact {
  name: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  github: string;
  website: string;
}

export interface NormalizedResumeExport {
  contact: ExportContact;
  sections: ExportSection[];
}

function trim(value: string | undefined) {
  return (value ?? '').trim();
}

function normalizeContact(contact: ContactInfo): ExportContact {
  return {
    name: trim(contact.name),
    email: trim(contact.email),
    phone: trim(contact.phone),
    location: trim(contact.location),
    linkedin: contact.showLinkedin === false ? '' : trim(contact.linkedin),
    github: contact.showGithub === false ? '' : trim(contact.github),
    website: contact.showWebsite === false ? '' : trim(contact.website),
  };
}

function normalizeTextOnlyEntry(id: string, text: string): ExportEntry | null {
  const cleanText = trim(text);
  if (!cleanText) {
    return null;
  }

  return {
    id,
    title: '',
    subtitle: '',
    text: cleanText,
    bullets: [],
  };
}

export function normalizeResumeForExport(resume: ResumeData): NormalizedResumeExport {
  const sections = resume.sections
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((section) => {
      const entries = section.items
        .filter((entry) => entry.selected)
        .map((entry) => {
          if (TEXT_ONLY_TYPES.has(section.type)) {
            return normalizeTextOnlyEntry(entry.id, entry.text ?? '');
          }

          const title = trim(entry.title);
          const subtitle = trim(entry.subtitle);
          const bullets = entry.bullets
            .filter((bullet) => bullet.selected)
            .map((bullet) => trim(bullet.text))
            .filter(Boolean);

          if (!title && !subtitle && bullets.length === 0) {
            return null;
          }

          return {
            id: entry.id,
            title,
            subtitle,
            text: '',
            bullets,
          } satisfies ExportEntry;
        })
        .filter((entry): entry is ExportEntry => entry !== null);

      return {
        id: section.id,
        type: section.type,
        label: trim(section.label),
        entries,
      } satisfies ExportSection;
    })
    .filter((section) => section.entries.length > 0);

  return {
    contact: normalizeContact(resume.contact),
    sections,
  };
}

export function getContactPrimaryLine(contact: ExportContact) {
  return [contact.email, contact.phone, contact.location].filter(Boolean).join(' | ');
}

export function getContactSecondaryLine(contact: ExportContact) {
  return [contact.linkedin, contact.github, contact.website].filter(Boolean).join(' | ');
}
