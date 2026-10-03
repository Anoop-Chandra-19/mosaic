import { randomUUID } from 'node:crypto';
import type { Database } from 'better-sqlite3';
import type { BundleTemplate, ImportMode, ImportResult, MosaicBundle } from '@shared/types/bundle';
import type { ResumeData } from '@shared/types/resume';
import { deleteUnusedDocs, readDoc, storeDoc } from './docs';
import { readDraft } from './drafts';
import { getTemplate, insertTemplateRow, listTemplates } from './templates';
import { insertVersion, listVersions, readDocHash } from './versions';

const iso = (ms: number) => new Date(ms).toISOString();

/** Versions that hold the same document share one object, as the file shares one entry. */
function exportTemplate(db: Database, id: string, docs: Map<string, ResumeData>): BundleTemplate {
  const template = getTemplate(db, id);
  const docOf = (versionId: string) => {
    const hash = readDocHash(db, versionId);
    let doc = docs.get(hash);
    if (!doc) {
      doc = readDoc(db, hash);
      docs.set(hash, doc);
    }
    return doc;
  };
  return {
    template: {
      id: template.id,
      name: template.name,
      rev: template.rev,
      createdAt: iso(template.createdAt),
      updatedAt: iso(template.updatedAt),
    },
    draft: readDraft(db, id).doc,
    versions: listVersions(db, id)
      .reverse()
      .map(
        ({ id: versionId, number, parentId, kind, source, summary, section, rev, createdAt }) => ({
          id: versionId,
          number,
          parentId,
          kind,
          source,
          summary,
          section,
          rev,
          createdAt: iso(createdAt),
          doc: docOf(versionId),
        })
      ),
  };
}

/** One template, some, or (by default) all of them, with drafts and full history. */
export function exportBundle(db: Database, templateIds?: string[]): MosaicBundle {
  return db.transaction(() => {
    const docs = new Map<string, ResumeData>();
    return {
      exportedAt: new Date().toISOString(),
      templates: (templateIds ?? listTemplates(db).map((t) => t.id)).map((id) =>
        exportTemplate(db, id, docs)
      ),
    };
  })();
}

function importTemplate(
  db: Database,
  entry: BundleTemplate,
  mode: ImportMode,
  hashes: WeakMap<ResumeData, string>
): string {
  const fresh = mode === 'as-new-template';
  const id = fresh ? randomUUID() : entry.template.id;
  // A fresh copy is new to this app; a restore puts the template back as it was.
  const createdAt = fresh ? Date.now() : Date.parse(entry.template.createdAt);
  const updatedAt = fresh ? createdAt : Date.parse(entry.template.updatedAt);

  insertTemplateRow(db, {
    id,
    name: entry.template.name,
    rev: entry.template.rev,
    createdAt,
    updatedAt,
    draft: entry.draft,
  });

  // parseBundle guarantees every parent is an earlier version of the same template.
  const versionIds = new Map<string, string>();
  for (const version of entry.versions) {
    const versionId = fresh ? randomUUID() : version.id;
    versionIds.set(version.id, versionId);
    // Versions sharing a document share its object, so each is stored and hashed once.
    let docHash = hashes.get(version.doc);
    if (!docHash) {
      docHash = storeDoc(db, version.doc);
      hashes.set(version.doc, docHash);
    }
    insertVersion(db, {
      id: versionId,
      number: version.number,
      templateId: id,
      parentId: version.parentId === null ? null : (versionIds.get(version.parentId) ?? null),
      kind: version.kind,
      source: version.source,
      summary: version.summary,
      section: version.section,
      doc: version.doc,
      docHash,
      rev: version.rev,
      createdAt: Date.parse(version.createdAt),
    });
  }
  return id;
}

/**
 * Write a parsed bundle (see `parseBundle`) in one transaction: a bad file changes
 * nothing. Restoring removes every existing template first.
 */
export function importBundle(db: Database, bundle: MosaicBundle, mode: ImportMode): ImportResult {
  return db.transaction(() => {
    if (mode === 'restore-all') db.prepare('delete from templates').run();
    const hashes = new WeakMap<ResumeData, string>();
    const templateIds = bundle.templates.map((entry) => importTemplate(db, entry, mode, hashes));
    // After the import, so a document the backup brings back again is kept, not rewritten.
    deleteUnusedDocs(db);
    return { templateIds };
  })();
}
