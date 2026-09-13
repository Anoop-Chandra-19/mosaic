import type { ResumeData, SectionType } from '@/types/resume';

const SECTION_TYPES: ReadonlySet<string> = new Set<SectionType>([
  'summary',
  'education',
  'experience',
  'internships',
  'projects',
  'skills',
  'certifications',
]);

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}

function isBullet(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.text === 'string' &&
    typeof value.selected === 'boolean'
  );
}

function isResumeEntry(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.selected === 'boolean' &&
    Array.isArray(value.bullets) &&
    value.bullets.every(isBullet) &&
    isOptionalString(value.title) &&
    isOptionalString(value.subtitle) &&
    isOptionalString(value.text) &&
    isOptionalString(value.startDate) &&
    isOptionalString(value.endDate)
  );
}

function isResumeSection(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.label === 'string' &&
    // Unknown section types are rejected: the preview/editor switch on them.
    typeof value.type === 'string' &&
    SECTION_TYPES.has(value.type) &&
    typeof value.order === 'number' &&
    Array.isArray(value.items) &&
    value.items.every(isResumeEntry)
  );
}

const CONTACT_STRING_FIELDS = [
  'name',
  'email',
  'phone',
  'location',
  'linkedin',
  'github',
  'website',
] as const;

/** Structural check for a ResumeData document read from outside the app (a file, IPC). */
export function isResumeData(value: unknown): value is ResumeData {
  if (!isRecord(value)) return false;
  if (typeof value.schemaVersion !== 'number') return false;
  const contact = value.contact;
  if (!isRecord(contact)) return false;
  if (!CONTACT_STRING_FIELDS.every((field) => isOptionalString(contact[field]))) {
    return false;
  }
  return Array.isArray(value.sections) && value.sections.every(isResumeSection);
}
