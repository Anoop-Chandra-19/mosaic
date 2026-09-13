import type { Database } from 'better-sqlite3';
import type { Draft } from '@/types/db';
import type { ResumeData } from '@/types/resume';
import { decodeDoc, encodeDoc } from './doc';
import { StorageError } from './errors';

interface DraftRow {
  template_id: string;
  doc: string;
  rev: number;
}

export function readDraft(db: Database, templateId: string): Draft {
  const row = db
    .prepare<[string], DraftRow>(
      `select d.template_id, d.doc, t.rev
         from drafts d join templates t on t.id = d.template_id
        where d.template_id = ?`
    )
    .get(templateId);
  if (!row) throw new StorageError('not-found', `No template with id ${templateId}`);
  return { templateId: row.template_id, doc: decodeDoc(row.doc), rev: row.rev };
}

/** The draft and its rev are written together; the anchor check trusts that they match. */
export function writeDraft(db: Database, templateId: string, doc: ResumeData, rev: number): void {
  const now = Date.now();
  db.transaction(() => {
    db.prepare('update drafts set doc = ?, updated_at = ? where template_id = ?').run(
      encodeDoc(doc),
      now,
      templateId
    );
    db.prepare('update templates set rev = ?, updated_at = ? where id = ?').run(
      rev,
      now,
      templateId
    );
  })();
}

/**
 * The editor's debounced save. `rev` is the renderer's counter — main never invents one
 * here, so the stored rev is always a rev the renderer had. A save older than the stored
 * rev is refused: it was queued before main replaced the draft (a restore) and would
 * silently undo it.
 */
export function saveDraft(db: Database, templateId: string, doc: ResumeData, rev: number): void {
  db.transaction(() => {
    const stored = db
      .prepare<[string], { rev: number }>('select rev from templates where id = ?')
      .get(templateId)?.rev;
    if (stored === undefined) {
      throw new StorageError('not-found', `No template with id ${templateId}`);
    }
    if (rev < stored) {
      throw new StorageError(
        'stale-rev',
        `Draft save at rev ${rev} is older than the stored rev ${stored}`
      );
    }
    writeDraft(db, templateId, doc, rev);
  })();
}
