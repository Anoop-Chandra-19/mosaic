import { CURRENT_SCHEMA_VERSION, migrateResume } from '@/lib/resume/migrateResume';
import { migrateTemplateState } from '@/lib/template/migrateTemplateState';
import { VAULT_VERSION, type MosaicVault } from '@/types/vault';
import type { ResumeData, SectionType } from '@/types/resume';

export type VaultErrorCode =
  | 'invalid-json'
  | 'not-a-vault'
  | 'unsupported-version'
  | 'invalid-resume'
  | 'invalid-templates';

export type VaultParseResult =
  | { ok: true; vault: MosaicVault }
  | { ok: false; code: VaultErrorCode; detail?: string };

const SECTION_TYPES: ReadonlySet<string> = new Set<SectionType>([
  'summary',
  'education',
  'experience',
  'internships',
  'projects',
  'skills',
  'certifications',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
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

function isResumeData(value: unknown): value is ResumeData {
  if (!isRecord(value)) return false;
  if (typeof value.schemaVersion !== 'number') return false;
  const contact = value.contact;
  if (!isRecord(contact)) return false;
  if (!CONTACT_STRING_FIELDS.every((field) => isOptionalString(contact[field]))) {
    return false;
  }
  return Array.isArray(value.sections) && value.sections.every(isResumeSection);
}

function isTemplateRecord(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string' &&
    typeof value.headVersionId === 'string'
  );
}

function isTemplateVersion(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.templateId === 'string' &&
    (value.parentVersionId === null || typeof value.parentVersionId === 'string') &&
    typeof value.createdAt === 'string' &&
    typeof value.message === 'string' &&
    typeof value.source === 'string' &&
    isResumeData(value.snapshot)
  );
}

type ValidationError = { code: VaultErrorCode; detail?: string };

function validateTemplates(value: unknown): ValidationError | null {
  if (!isRecord(value)) return { code: 'invalid-templates', detail: 'not an object' };

  const templates = value.templates;
  if (!Array.isArray(templates) || !templates.every(isTemplateRecord)) {
    return { code: 'invalid-templates', detail: 'malformed template records' };
  }

  const versionsByTemplateId = value.versionsByTemplateId;
  if (!isRecord(versionsByTemplateId)) {
    return { code: 'invalid-templates', detail: 'malformed version map' };
  }
  for (const versions of Object.values(versionsByTemplateId)) {
    if (!Array.isArray(versions) || !versions.every(isTemplateVersion)) {
      return { code: 'invalid-templates', detail: 'malformed template versions' };
    }
  }

  // A template whose head version is missing is corrupt beyond repair.
  for (const template of templates as Array<Record<string, unknown>>) {
    const versions = versionsByTemplateId[template.id as string];
    const hasHead =
      Array.isArray(versions) &&
      versions.some((v) => (v as Record<string, unknown>).id === template.headVersionId);
    if (!hasHead) {
      return {
        code: 'invalid-templates',
        detail: `template "${template.name}" has no head version`,
      };
    }
  }

  return null;
}

function findNewerSchemaVersion(resume: ResumeData, templates: Record<string, unknown>): boolean {
  if (resume.schemaVersion > CURRENT_SCHEMA_VERSION) return true;
  const versionsByTemplateId = templates.versionsByTemplateId as Record<string, unknown[]>;
  for (const versions of Object.values(versionsByTemplateId)) {
    for (const version of versions) {
      const snapshot = (version as Record<string, unknown>).snapshot as ResumeData;
      if (snapshot.schemaVersion > CURRENT_SCHEMA_VERSION) return true;
    }
  }
  return false;
}

/**
 * Validate and migrate a raw vault backup file. Returns a result instead of
 * throwing so the UI can map error codes to friendly messages.
 */
export function parseVault(raw: string): VaultParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, code: 'invalid-json' };
  }

  if (!isRecord(parsed)) return { ok: false, code: 'not-a-vault' };

  const { vaultVersion } = parsed;
  if (typeof vaultVersion !== 'number') return { ok: false, code: 'not-a-vault' };
  if (vaultVersion > VAULT_VERSION) return { ok: false, code: 'unsupported-version' };
  if (vaultVersion !== VAULT_VERSION) return { ok: false, code: 'not-a-vault' };

  if (!isRecord(parsed.resume) || !isRecord(parsed.templates)) {
    return { ok: false, code: 'not-a-vault' };
  }

  if (!isResumeData(parsed.resume)) return { ok: false, code: 'invalid-resume' };

  const templatesError = validateTemplates(parsed.templates);
  if (templatesError) return { ok: false, ...templatesError };

  // Refuse files written by a newer Mosaic rather than silently downgrading.
  if (findNewerSchemaVersion(parsed.resume, parsed.templates)) {
    return { ok: false, code: 'unsupported-version' };
  }

  return {
    ok: true,
    vault: {
      vaultVersion: VAULT_VERSION,
      exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : '',
      resume: migrateResume(parsed.resume),
      // Migrates every version snapshot and repairs dangling active ids.
      templates: migrateTemplateState(parsed.templates),
    },
  };
}
