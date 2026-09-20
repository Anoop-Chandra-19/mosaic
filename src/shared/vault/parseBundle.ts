import { CURRENT_SCHEMA_VERSION, migrateResume } from '../resume/migrateResume';
import { isRecord, isResumeData } from '../resume/validateResume';
import {
  BUNDLE_VERSION,
  type BundleTemplate,
  type BundleVersion,
  type MosaicBundle,
} from '../types/bundle';
import type { VersionKind, VersionSource } from '../types/db';
import type { ResumeData } from '../types/resume';

export type BundleErrorCode =
  | 'invalid-json'
  | 'not-a-bundle'
  | 'unsupported-version'
  | 'invalid-resume'
  | 'invalid-templates';

export type BundleParseResult =
  | { ok: true; bundle: MosaicBundle }
  | { ok: false; code: BundleErrorCode; detail?: string };

const VERSION_KINDS: ReadonlySet<string> = new Set<VersionKind>(['auto', 'named']);

const VERSION_SOURCES: ReadonlySet<string> = new Set<VersionSource>([
  'create',
  'duplicate',
  'name',
  'import',
  'restore',
  'edit',
]);

class BundleError extends Error {
  readonly code: BundleErrorCode;
  readonly detail?: string;

  constructor(code: BundleErrorCode, detail?: string) {
    super(detail ?? code);
    this.code = code;
    this.detail = detail;
  }
}

function requireString(value: unknown, what: string): string {
  if (typeof value !== 'string') throw new BundleError('invalid-templates', `${what} is missing`);
  return value;
}

function requireTimestamp(value: unknown, what: string): string {
  const text = requireString(value, what);
  if (Number.isNaN(Date.parse(text))) {
    throw new BundleError('invalid-templates', `${what} is not a date`);
  }
  return text;
}

function requireRev(value: unknown, what: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new BundleError('invalid-templates', `${what} is not a revision number`);
  }
  return value as number;
}

function requireDoc(value: unknown, what: string): ResumeData {
  if (!isResumeData(value)) throw new BundleError('invalid-resume', `${what} is not a resume`);
  // Refuse files written by a newer Mosaic rather than silently downgrading.
  if (value.schemaVersion > CURRENT_SCHEMA_VERSION) {
    throw new BundleError('unsupported-version', `${what} was written by a newer Mosaic`);
  }
  return migrateResume(value);
}

function parseVersions(value: unknown, templateName: string, ids: Set<string>): BundleVersion[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new BundleError('invalid-templates', `template "${templateName}" has no versions`);
  }

  const earlier = new Set<string>();
  return value.map((raw: unknown, index) => {
    const what = `version ${index + 1} of "${templateName}"`;
    if (!isRecord(raw)) throw new BundleError('invalid-templates', `${what} is malformed`);

    const id = requireString(raw.id, `${what}'s id`);
    if (ids.has(id)) throw new BundleError('invalid-templates', `${what} repeats id ${id}`);
    ids.add(id);

    if (typeof raw.kind !== 'string' || !VERSION_KINDS.has(raw.kind)) {
      throw new BundleError('invalid-templates', `${what} has an unknown kind`);
    }
    if (typeof raw.source !== 'string' || !VERSION_SOURCES.has(raw.source)) {
      throw new BundleError('invalid-templates', `${what} has an unknown source`);
    }

    const version: BundleVersion = {
      id,
      // A parent outside this template, or not yet seen, cannot be linked on import.
      parentId: typeof raw.parentId === 'string' && earlier.has(raw.parentId) ? raw.parentId : null,
      kind: raw.kind as VersionKind,
      source: raw.source as VersionSource,
      summary: requireString(raw.summary, `${what}'s summary`),
      rev: requireRev(raw.rev, `${what}'s rev`),
      createdAt: requireTimestamp(raw.createdAt, `${what}'s date`),
      doc: requireDoc(raw.doc, what),
    };
    earlier.add(id);
    return version;
  });
}

function parseTemplate(
  value: unknown,
  templateIds: Set<string>,
  versionIds: Set<string>
): BundleTemplate {
  if (!isRecord(value) || !isRecord(value.template)) {
    throw new BundleError('invalid-templates', 'malformed template');
  }

  const raw = value.template;
  const name = requireString(raw.name, "a template's name");
  const id = requireString(raw.id, `template "${name}"'s id`);
  if (templateIds.has(id)) throw new BundleError('invalid-templates', `template id ${id} repeats`);
  templateIds.add(id);

  return {
    template: {
      id,
      name,
      rev: requireRev(raw.rev, `template "${name}"'s rev`),
      createdAt: requireTimestamp(raw.createdAt, `template "${name}"'s date`),
      updatedAt: requireTimestamp(raw.updatedAt, `template "${name}"'s date`),
    },
    draft: requireDoc(value.draft, `the draft of "${name}"`),
    versions: parseVersions(value.versions, name, versionIds),
  };
}

/**
 * Validate and migrate a raw bundle file. Returns a result instead of throwing so
 * the UI can map error codes to friendly messages.
 */
export function parseBundle(raw: string): BundleParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, code: 'invalid-json' };
  }

  if (!isRecord(parsed) || typeof parsed.bundleVersion !== 'number') {
    return { ok: false, code: 'not-a-bundle' };
  }
  if (parsed.bundleVersion > BUNDLE_VERSION) return { ok: false, code: 'unsupported-version' };
  if (parsed.bundleVersion !== BUNDLE_VERSION) return { ok: false, code: 'not-a-bundle' };

  if (!Array.isArray(parsed.templates) || parsed.templates.length === 0) {
    return { ok: false, code: 'invalid-templates', detail: 'no templates' };
  }

  try {
    const templateIds = new Set<string>();
    const versionIds = new Set<string>();
    return {
      ok: true,
      bundle: {
        bundleVersion: BUNDLE_VERSION,
        exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : '',
        templates: parsed.templates.map((t: unknown) => parseTemplate(t, templateIds, versionIds)),
      },
    };
  } catch (error) {
    if (error instanceof BundleError) return { ok: false, code: error.code, detail: error.detail };
    throw error;
  }
}
