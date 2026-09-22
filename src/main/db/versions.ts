import { randomUUID } from 'node:crypto';
import type { Database } from 'better-sqlite3';
import type {
  AutoSnapshot,
  Draft,
  SnapshotOccasion,
  Version,
  VersionKind,
  VersionMeta,
  VersionSource,
} from '@shared/types/db';
import { describeDraftChanges } from '@shared/resume/describeDraftChanges';
import type { ResumeData } from '@shared/types/resume';
import { hashDoc, readDoc, storeDoc } from './docs';
import { readDraft, writeDraft } from './drafts';
import { StorageError } from './storageError';

interface VersionRow {
  id: string;
  template_id: string;
  parent_id: string | null;
  kind: VersionKind;
  source: VersionSource;
  summary: string;
  section: string | null;
  rev: number;
  created_at: number;
}

const META_COLUMNS = 'id, template_id, parent_id, kind, source, summary, section, rev, created_at';

function toMeta(row: VersionRow): VersionMeta {
  return {
    id: row.id,
    templateId: row.template_id,
    parentId: row.parent_id,
    kind: row.kind,
    source: row.source,
    summary: row.summary,
    section: row.section,
    rev: row.rev,
    createdAt: row.created_at,
  };
}

/** The newest version — the one the draft was last in sync with. */
export function headVersion(db: Database, templateId: string): VersionMeta | undefined {
  const row = db
    .prepare<
      [string],
      VersionRow
    >(`select ${META_COLUMNS} from versions where template_id = ? order by seq desc limit 1`)
    .get(templateId);
  return row && toMeta(row);
}

export function countVersions(db: Database, templateId: string): number {
  return db
    .prepare<[string], { n: number }>('select count(*) as n from versions where template_id = ?')
    .get(templateId)!.n;
}

/** Newest first, without documents — cheap enough to list the whole history. */
export function listVersions(db: Database, templateId: string): VersionMeta[] {
  return db
    .prepare<
      [string],
      VersionRow
    >(`select ${META_COLUMNS} from versions where template_id = ? order by seq desc`)
    .all(templateId)
    .map(toMeta);
}

function readDocHash(db: Database, versionId: string): string {
  const row = db
    .prepare<[string], { doc_hash: string }>('select doc_hash from versions where id = ?')
    .get(versionId);
  if (!row) throw new StorageError('not-found', `No version with id ${versionId}`);
  return row.doc_hash;
}

export function getVersion(db: Database, versionId: string): Version {
  const row = db
    .prepare<
      [string],
      VersionRow & { doc_hash: string }
    >(`select ${META_COLUMNS}, doc_hash from versions where id = ?`)
    .get(versionId);
  if (!row) throw new StorageError('not-found', `No version with id ${versionId}`);
  return { ...toMeta(row), doc: readDoc(db, row.doc_hash) };
}

export interface NewVersion {
  templateId: string;
  parentId: string | null;
  kind: VersionKind;
  source: VersionSource;
  summary: string;
  section?: string | null;
  doc: ResumeData;
  rev: number;
  /** Set only when importing a bundle, which keeps its ids and dates. */
  id?: string;
  createdAt?: number;
}

/** Appends a version after the template's current head. */
export function insertVersion(db: Database, version: NewVersion): VersionMeta {
  const meta: VersionMeta = {
    id: version.id ?? randomUUID(),
    templateId: version.templateId,
    parentId: version.parentId,
    kind: version.kind,
    source: version.source,
    summary: version.summary,
    section: version.section ?? null,
    rev: version.rev,
    createdAt: version.createdAt ?? Date.now(),
  };
  db.prepare(
    `insert into versions (id, template_id, seq, parent_id, kind, source, summary, section, rev, created_at, doc_hash)
     values (?, ?, (select coalesce(max(seq), 0) + 1 from versions where template_id = ?), ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    meta.id,
    meta.templateId,
    meta.templateId,
    meta.parentId,
    meta.kind,
    meta.source,
    meta.summary,
    meta.section,
    meta.rev,
    meta.createdAt,
    storeDoc(db, version.doc)
  );
  return meta;
}

/**
 * The newest version, when the draft is still that version and there is nothing to keep:
 * either the revs match, or edit-then-undo left the rev bumped over identical content, so
 * the document hashes are compared as a tie-breaker. In that second case the head adopts
 * the draft's rev, which makes the draft clean again and saves a row that says nothing.
 */
function headHoldingDraft(
  db: Database,
  head: VersionMeta | undefined,
  draft: Draft
): VersionMeta | undefined {
  if (!head) return undefined;
  if (head.rev === draft.rev) return head;
  if (readDocHash(db, head.id) !== hashDoc(draft.doc)) return undefined;
  db.prepare('update versions set rev = ? where id = ?').run(draft.rev, head.id);
  return { ...head, rev: draft.rev };
}

/**
 * Keep the draft as an auto version — before an import or restore replaces it. A draft
 * the head already holds writes nothing, and that head is returned instead.
 */
export function snapshotDraft(db: Database, input: AutoSnapshot): VersionMeta {
  return db.transaction(() => {
    const draft = readDraft(db, input.templateId);
    const head = headVersion(db, input.templateId);
    const kept = headHoldingDraft(db, head, draft);
    if (kept) return kept;
    return insertVersion(db, {
      templateId: input.templateId,
      parentId: head?.id ?? null,
      kind: 'auto',
      source: input.source,
      summary: input.summary,
      doc: draft.doc,
      rev: draft.rev,
    });
  })();
}

const STOP_SUMMARIES: Record<Exclude<SnapshotOccasion, 'edit'>, string> = {
  switched: 'Where you left it before switching templates',
  closed: 'Where you left it',
};

/**
 * Keep the draft as an auto version of editing itself. Only `edit` snapshots diff against
 * the newest version; where editing stopped gets a fixed summary, which keeps closing cheap.
 */
export function snapshotEditedDraft(
  db: Database,
  templateId: string,
  occasion: SnapshotOccasion
): VersionMeta {
  return db.transaction(() => {
    const draft = readDraft(db, templateId);
    const head = headVersion(db, templateId);
    const kept = headHoldingDraft(db, head, draft);
    if (kept) return kept;
    const changes =
      occasion !== 'edit'
        ? { summary: STOP_SUMMARIES[occasion], section: null }
        : head
          ? describeDraftChanges(getVersion(db, head.id).doc, draft.doc)
          : { summary: 'Edited the resume', section: null };
    return insertVersion(db, {
      templateId,
      parentId: head?.id ?? null,
      kind: 'auto',
      source: occasion,
      ...changes,
      doc: draft.doc,
      rev: draft.rev,
    });
  })();
}

/**
 * Name what is in the editor. A draft the head already holds renames that version instead
 * of minting a duplicate.
 */
export function nameDraft(db: Database, templateId: string, name: string): VersionMeta {
  return db.transaction(() => {
    const draft = readDraft(db, templateId);
    const head = headVersion(db, templateId);
    const clean = headHoldingDraft(db, head, draft);

    if (clean) {
      db.prepare(`update versions set kind = 'named', summary = ? where id = ?`).run(
        name,
        clean.id
      );
      return { ...clean, kind: 'named' as const, summary: name };
    }

    return insertVersion(db, {
      templateId,
      parentId: head?.id ?? null,
      kind: 'named',
      source: 'name',
      summary: name,
      doc: draft.doc,
      rev: draft.rev,
    });
  })();
}

interface Replacement {
  source: VersionSource;
  /** Summary for the auto version that keeps unsaved edits. */
  before: string;
  /** Summary for the version holding the new document. */
  after: string;
  /** What the new document came from; defaults to the draft it replaced. */
  parentId?: string;
}

/**
 * Replace the editor's document from outside the editor. Unsaved edits are kept as an
 * auto version first, and the new document is recorded too, so the change can be undone
 * from history and the draft starts clean. The rev moves forward — the document changed
 * under the renderer's anchors — and the returned draft carries it.
 */
function replaceDraft(
  db: Database,
  templateId: string,
  doc: ResumeData,
  replacement: Replacement
): Draft {
  const draft = readDraft(db, templateId);
  const kept = snapshotDraft(db, {
    templateId,
    source: replacement.source,
    summary: replacement.before,
  });
  const rev = draft.rev + 1;
  insertVersion(db, {
    templateId,
    parentId: replacement.parentId ?? kept.id,
    kind: 'auto',
    source: replacement.source,
    summary: replacement.after,
    doc,
    rev,
  });
  writeDraft(db, templateId, doc, rev);
  return { templateId, doc, rev };
}

/** Put an older version back in the editor. */
export function restoreVersion(db: Database, templateId: string, versionId: string): Draft {
  return db.transaction(() => {
    const version = getVersion(db, versionId);
    if (version.templateId !== templateId) {
      throw new StorageError('not-found', `Version ${versionId} is not in template ${templateId}`);
    }

    const draft = readDraft(db, templateId);
    const head = headVersion(db, templateId);
    // Restoring the version the editor already matches changes nothing.
    if (head?.id === versionId && head.rev === draft.rev) return draft;

    return replaceDraft(db, templateId, version.doc, {
      source: 'restore',
      before: `Before restoring "${version.summary}"`,
      after: `Restored "${version.summary}"`,
      parentId: version.id,
    });
  })();
}

/**
 * Import a resume over the editor's document — pasted text today, PDF/DOCX later. The
 * import review happens before this; `from` names the source for history
 * ("platform-resume.docx", "pasted text").
 */
export function importIntoDraft(
  db: Database,
  templateId: string,
  doc: ResumeData,
  from: string
): Draft {
  return db.transaction(() =>
    replaceDraft(db, templateId, doc, {
      source: 'import',
      before: `Before importing ${from}`,
      after: `Imported from ${from}`,
    })
  )();
}
