import { randomUUID } from 'node:crypto';
import type { Database } from 'better-sqlite3';
import type {
  AutoSnapshot,
  Draft,
  Version,
  VersionKind,
  VersionMeta,
  VersionSource,
} from '@shared/types/db';
import type { ResumeData } from '@shared/types/resume';
import { readDraft, writeDraft } from './drafts';
import { StorageError } from './storageError';
import { encodeStoredResume, parseAndMigrateStoredResume } from './storedResume';

interface VersionRow {
  id: string;
  template_id: string;
  parent_id: string | null;
  kind: VersionKind;
  source: VersionSource;
  summary: string;
  rev: number;
  created_at: number;
}

const META_COLUMNS = 'id, template_id, parent_id, kind, source, summary, rev, created_at';

function toMeta(row: VersionRow): VersionMeta {
  return {
    id: row.id,
    templateId: row.template_id,
    parentId: row.parent_id,
    kind: row.kind,
    source: row.source,
    summary: row.summary,
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

export function getVersion(db: Database, versionId: string): Version {
  const row = db
    .prepare<
      [string],
      VersionRow & { doc: string }
    >(`select ${META_COLUMNS}, doc from versions where id = ?`)
    .get(versionId);
  if (!row) throw new StorageError('not-found', `No version with id ${versionId}`);
  return { ...toMeta(row), doc: parseAndMigrateStoredResume(row.doc) };
}

export interface NewVersion {
  templateId: string;
  parentId: string | null;
  kind: VersionKind;
  source: VersionSource;
  summary: string;
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
    rev: version.rev,
    createdAt: version.createdAt ?? Date.now(),
  };
  db.prepare(
    `insert into versions (id, template_id, seq, parent_id, kind, source, summary, doc, rev, created_at)
     values (?, ?, (select coalesce(max(seq), 0) + 1 from versions where template_id = ?), ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    meta.id,
    meta.templateId,
    meta.templateId,
    meta.parentId,
    meta.kind,
    meta.source,
    meta.summary,
    encodeStoredResume(version.doc),
    meta.rev,
    meta.createdAt
  );
  return meta;
}

/**
 * Keep the draft as an auto version — before an import or restore replaces it. A clean
 * draft is already the head, so the head is returned and no duplicate row is written.
 */
export function snapshotDraft(db: Database, input: AutoSnapshot): VersionMeta {
  return db.transaction(() => {
    const draft = readDraft(db, input.templateId);
    const head = headVersion(db, input.templateId);
    if (head && head.rev === draft.rev) return head;
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

/**
 * Name what is in the editor. A clean draft renames the head instead of minting a
 * duplicate. Edit-then-undo leaves the rev bumped over identical content, so the
 * documents are compared as a tie-breaker — and the head adopts the draft's rev,
 * which makes the draft clean again.
 */
export function nameDraft(db: Database, templateId: string, name: string): VersionMeta {
  return db.transaction(() => {
    const draft = readDraft(db, templateId);
    const head = headVersion(db, templateId);
    const clean =
      head !== undefined &&
      (head.rev === draft.rev ||
        encodeStoredResume(getVersion(db, head.id).doc) === encodeStoredResume(draft.doc));

    if (clean) {
      db.prepare(`update versions set kind = 'named', summary = ?, rev = ? where id = ?`).run(
        name,
        draft.rev,
        head.id
      );
      return { ...head, kind: 'named' as const, summary: name, rev: draft.rev };
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
