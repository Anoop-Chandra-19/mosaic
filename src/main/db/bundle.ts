import { randomUUID } from 'node:crypto';
import type { Database } from 'better-sqlite3';
import {
  BUNDLE_VERSION,
  type BundleTemplate,
  type ImportMode,
  type ImportResult,
  type MosaicBundle,
} from '@shared/types/bundle';
import { readDraft } from './drafts';
import { getTemplate, insertTemplateRow, listTemplates } from './templates';
import { getVersion, insertVersion, listVersions } from './versions';

const iso = (ms: number) => new Date(ms).toISOString();

function exportTemplate(db: Database, id: string): BundleTemplate {
  const template = getTemplate(db, id);
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
      .map(({ id: versionId, parentId, kind, source, summary, section, rev, createdAt }) => ({
        id: versionId,
        parentId,
        kind,
        source,
        summary,
        section,
        rev,
        createdAt: iso(createdAt),
        doc: getVersion(db, versionId).doc,
      })),
  };
}

/** One template, some, or (by default) all of them, with drafts and full history. */
export function exportBundle(db: Database, templateIds?: string[]): MosaicBundle {
  return db.transaction(() => ({
    bundleVersion: BUNDLE_VERSION,
    exportedAt: new Date().toISOString(),
    templates: (templateIds ?? listTemplates(db).map((t) => t.id)).map((id) =>
      exportTemplate(db, id)
    ),
  }))();
}

function importTemplate(db: Database, entry: BundleTemplate, mode: ImportMode): string {
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
    insertVersion(db, {
      id: versionId,
      templateId: id,
      parentId: version.parentId === null ? null : (versionIds.get(version.parentId) ?? null),
      kind: version.kind,
      source: version.source,
      summary: version.summary,
      section: version.section,
      doc: version.doc,
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
    return { templateIds: bundle.templates.map((entry) => importTemplate(db, entry, mode)) };
  })();
}
