import { CURRENT_SCHEMA_VERSION, migrateResume } from '../resume/migrateResume';
import { isRecord, isResumeData } from '../resume/validateResume';
import {
  BUNDLE_VERSION,
  type BundleTemplate,
  type BundleVersion,
  type MosaicBundle,
} from '../types/bundle';
import { isDbText, MAX_DB_TEXT_LENGTH, type VersionKind, type VersionSource } from '../types/db';
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
  'before-import',
  'restore',
  'before-restore',
  'edit',
  'switched',
  'closed',
  'assistant',
  'before-apply',
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

function requireDbText(value: unknown, what: string): string {
  if (!isDbText(value)) {
    throw new BundleError(
      'invalid-templates',
      `${what} is not text of 1–${MAX_DB_TEXT_LENGTH} characters`
    );
  }
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
  // Checked first, so a newer Mosaic's file says so instead of reading as damaged.
  if (isRecord(value) && (value.schemaVersion as number) > CURRENT_SCHEMA_VERSION) {
    throw new BundleError('unsupported-version', `${what} was written by a newer Mosaic`);
  }
  if (!isResumeData(value)) throw new BundleError('invalid-resume', `${what} is not a resume`);
  return migrateResume(value);
}

/**
 * The file's documents, each checked the first time something names it, and shared by
 * everything that does.
 */
function createDocReader(docs: Record<string, unknown>) {
  const read = new Map<string, ResumeData>();
  return (id: unknown, what: string): ResumeData => {
    if (typeof id !== 'string' || !Object.hasOwn(docs, id)) {
      throw new BundleError('invalid-templates', `${what} names a document the file doesn't have`);
    }
    let doc = read.get(id);
    if (!doc) {
      doc = requireDoc(docs[id], `document ${id}`);
      read.set(id, doc);
    }
    return doc;
  };
}

type DocReader = ReturnType<typeof createDocReader>;

interface VersionLabel {
  number: number;
  revision: number;
}

/** "v7.1" as its two numbers. Files from before revisions have none: the version itself. */
function requireLabel(raw: Record<string, unknown>, what: string): VersionLabel {
  const revision = raw.revision ?? 0;
  if (!Number.isSafeInteger(raw.number) || (raw.number as number) < 1) {
    throw new BundleError('invalid-templates', `${what} has no version number`);
  }
  if (!Number.isSafeInteger(revision) || (revision as number) < 0) {
    throw new BundleError('invalid-templates', `${what} has no revision number`);
  }
  return { number: raw.number as number, revision: revision as number };
}

/** Oldest first: a higher number, or a later revision of the same one. */
function isLabelAfter(label: VersionLabel, previous: VersionLabel): boolean {
  return (
    label.number > previous.number ||
    (label.number === previous.number && label.revision > previous.revision)
  );
}

function parseVersions(
  value: unknown,
  templateName: string,
  ids: Set<string>,
  readDoc: DocReader
): BundleVersion[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new BundleError('invalid-templates', `template "${templateName}" has no versions`);
  }

  const earlier = new Set<string>();
  let previous = { number: 0, revision: 0 };
  return value.map((raw: unknown, index) => {
    const what = `version ${index + 1} of "${templateName}"`;
    if (!isRecord(raw)) throw new BundleError('invalid-templates', `${what} is malformed`);

    const id = requireDbText(raw.id, `${what}'s id`);
    if (ids.has(id)) throw new BundleError('invalid-templates', `${what} repeats id ${id}`);
    ids.add(id);

    if (typeof raw.kind !== 'string' || !VERSION_KINDS.has(raw.kind)) {
      throw new BundleError('invalid-templates', `${what} has an unknown kind`);
    }
    if (typeof raw.source !== 'string' || !VERSION_SOURCES.has(raw.source)) {
      throw new BundleError('invalid-templates', `${what} has an unknown source`);
    }

    const label = requireLabel(raw, what);
    if (!isLabelAfter(label, previous)) {
      throw new BundleError('invalid-templates', `${what}'s number doesn't follow the one before`);
    }
    previous = label;

    const version: BundleVersion = {
      id,
      ...label,
      // A parent outside this template, or not yet seen, cannot be linked on import.
      parentId: typeof raw.parentId === 'string' && earlier.has(raw.parentId) ? raw.parentId : null,
      kind: raw.kind as VersionKind,
      source: raw.source as VersionSource,
      summary: requireString(raw.summary, `${what}'s summary`),
      section: typeof raw.section === 'string' ? raw.section : null,
      rev: requireRev(raw.rev, `${what}'s rev`),
      createdAt: requireTimestamp(raw.createdAt, `${what}'s date`),
      doc: readDoc(raw.docId, what),
    };
    earlier.add(id);
    return version;
  });
}

function parseTemplate(
  value: unknown,
  templateIds: Set<string>,
  versionIds: Set<string>,
  readDoc: DocReader
): BundleTemplate {
  if (!isRecord(value) || !isRecord(value.template)) {
    throw new BundleError('invalid-templates', 'malformed template');
  }

  const raw = value.template;
  const name = requireDbText(raw.name, "a template's name");
  const id = requireDbText(raw.id, `template "${name}"'s id`);
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
    draft: readDoc(value.draftDocId, `the draft of "${name}"`),
    versions: parseVersions(value.versions, name, versionIds, readDoc),
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
  if (!isRecord(parsed.docs)) {
    return { ok: false, code: 'invalid-templates', detail: 'no documents' };
  }

  try {
    const templateIds = new Set<string>();
    const versionIds = new Set<string>();
    const readDoc = createDocReader(parsed.docs);
    return {
      ok: true,
      bundle: {
        exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : '',
        templates: parsed.templates.map((t: unknown) =>
          parseTemplate(t, templateIds, versionIds, readDoc)
        ),
      },
    };
  } catch (error) {
    if (error instanceof BundleError) return { ok: false, code: error.code, detail: error.detail };
    throw error;
  }
}
