import { randomUUID } from 'node:crypto';
import type { Database } from 'better-sqlite3';
import type { Draft, TemplateSummary, VersionSource } from '@shared/types/db';
import type { ResumeData } from '@shared/types/resume';
import { deleteUnusedDocs } from './docs';
import { readDraft } from './drafts';
import { ACTIVE_TEMPLATE_KEY, getSetting, removeSetting, setSetting } from './settings';
import { StorageError } from './storageError';
import { encodeStoredResume } from './storedResume';
import { countVersions, getVersion, headVersion, insertVersion } from './versions';

interface TemplateRow {
  id: string;
  name: string;
  rev: number;
  created_at: number;
  updated_at: number;
}

const TEMPLATE_COLUMNS = 'id, name, rev, created_at, updated_at';

function summarize(db: Database, row: TemplateRow): TemplateSummary {
  const head = headVersion(db, row.id);
  if (!head) throw new Error(`Template ${row.id} has no versions`);
  return {
    id: row.id,
    name: row.name,
    rev: row.rev,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    versionCount: countVersions(db, row.id),
    head,
  };
}

/** In list order: the order they were added in. */
export function listTemplates(db: Database): TemplateSummary[] {
  return db
    .prepare<[], TemplateRow>(`select ${TEMPLATE_COLUMNS} from templates order by seq`)
    .all()
    .map((row) => summarize(db, row));
}

export function getTemplate(db: Database, id: string): TemplateSummary {
  const row = db
    .prepare<[string], TemplateRow>(`select ${TEMPLATE_COLUMNS} from templates where id = ?`)
    .get(id);
  if (!row) throw new StorageError('not-found', `No template with id ${id}`);
  return summarize(db, row);
}

export interface NewTemplate {
  id: string;
  name: string;
  rev: number;
  createdAt: number;
  updatedAt: number;
  draft: ResumeData;
}

/** A template row and its draft, placed last in the list. Callers add its versions. */
export function insertTemplateRow(db: Database, template: NewTemplate): void {
  db.prepare(
    `insert into templates (id, name, seq, rev, created_at, updated_at)
     values (?, ?, (select coalesce(max(seq), 0) + 1 from templates), ?, ?, ?)`
  ).run(template.id, template.name, template.rev, template.createdAt, template.updatedAt);
  db.prepare('insert into drafts (template_id, doc, updated_at) values (?, ?, ?)').run(
    template.id,
    encodeStoredResume(template.draft),
    template.updatedAt
  );
}

/** A template, its draft, and the first version that the draft starts clean against. */
function insertTemplate(
  db: Database,
  name: string,
  doc: ResumeData,
  source: VersionSource,
  summary: string
): TemplateSummary {
  const id = randomUUID();
  const now = Date.now();
  return db.transaction(() => {
    insertTemplateRow(db, { id, name, rev: 0, createdAt: now, updatedAt: now, draft: doc });
    insertVersion(db, {
      templateId: id,
      parentId: null,
      kind: 'auto',
      source,
      summary,
      doc,
      rev: 0,
      createdAt: now,
    });
    return getTemplate(db, id);
  })();
}

/**
 * A new template: blank, from the example, or from an import — `importedFrom` names the
 * source for history ("platform-resume.docx", "pasted text").
 */
export function createTemplate(
  db: Database,
  name: string,
  doc: ResumeData,
  importedFrom?: string
): TemplateSummary {
  return importedFrom === undefined
    ? insertTemplate(db, name, doc, 'create', 'Created')
    : insertTemplate(db, name, doc, 'import', `Imported from ${importedFrom}`);
}

export function renameTemplate(db: Database, id: string, name: string): void {
  const { changes } = db.prepare('update templates set name = ? where id = ?').run(name, id);
  if (changes === 0) throw new StorageError('not-found', `No template with id ${id}`);
}

/** Copies what is in the editor — unsaved edits included — but not the history. */
export function duplicateTemplate(db: Database, id: string): TemplateSummary {
  return db.transaction(() => {
    const source = getTemplate(db, id);
    return insertTemplate(
      db,
      `${source.name} (copy)`,
      readDraft(db, id).doc,
      'duplicate',
      `Duplicated from "${source.name}"`
    );
  })();
}

/**
 * A new template from one version — branching from a snapshot, as in git. The version
 * names its template, so nothing else is needed. The copy starts its own history; its
 * first entry records where it came from.
 */
export function duplicateVersion(db: Database, versionId: string): TemplateSummary {
  return db.transaction(() => {
    const version = getVersion(db, versionId);
    const source = getTemplate(db, version.templateId);
    return insertTemplate(
      db,
      `${source.name} (copy)`,
      version.doc,
      'duplicate',
      `Duplicated from "${source.name}", version "${version.summary}"`
    );
  })();
}

/** Deletes the template with its draft and history — the last one included. */
export function removeTemplate(db: Database, id: string): void {
  db.transaction(() => {
    const { changes } = db.prepare('delete from templates where id = ?').run(id);
    if (changes === 0) throw new StorageError('not-found', `No template with id ${id}`);
    deleteUnusedDocs(db);
    if (getSetting(db, ACTIVE_TEMPLATE_KEY) === id) removeSetting(db, ACTIVE_TEMPLATE_KEY);
  })();
}

/** Loads a template's draft into the editor and remembers it for the next launch. */
export function openTemplate(db: Database, id: string): Draft {
  return db.transaction(() => {
    const draft = readDraft(db, id);
    setSetting(db, ACTIVE_TEMPLATE_KEY, id);
    return draft;
  })();
}
