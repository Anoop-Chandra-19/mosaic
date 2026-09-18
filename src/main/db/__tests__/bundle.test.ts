import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDefaultResume } from '@shared/resume/defaultResume';
import { parseBundle } from '@shared/vault/parseBundle';
import type { MosaicBundle } from '@shared/types/bundle';
import type { ResumeData } from '@shared/types/resume';
import { exportBundle, importBundle } from '../bundle';
import { openDatabase, type Database } from '../connection';
import { readDraft, saveDraft } from '../drafts';
import { createTemplate, listTemplates } from '../templates';
import { listVersions, nameDraft, restoreVersion } from '../versions';

let db: Database;

beforeEach(() => {
  db = openDatabase(':memory:');
});

afterEach(() => {
  db.close();
});

function resumeFor(name: string): ResumeData {
  const doc = createDefaultResume();
  doc.contact.name = name;
  return doc;
}

/** Two templates with real history: named versions, a restore, and unsaved edits. */
function seedHistory(): void {
  const cv = createTemplate(db, 'Backend CV', resumeFor('A'));
  saveDraft(db, cv.id, resumeFor('B'), 1);
  nameDraft(db, cv.id, 'Sent to Fastly');
  restoreVersion(db, cv.id, cv.head.id);
  saveDraft(db, cv.id, resumeFor('C, unsaved'), 3);

  createTemplate(db, 'Frontend CV', resumeFor('F'));
}

/** Through the file format and back, as a real export → import does. */
function roundTrip(bundle: MosaicBundle): MosaicBundle {
  const parsed = parseBundle(JSON.stringify(bundle, null, 2));
  if (!parsed.ok) throw new Error(`bundle did not parse: ${parsed.code} ${parsed.detail ?? ''}`);
  return parsed.bundle;
}

const withoutDate = (bundle: MosaicBundle) => ({ ...bundle, exportedAt: undefined });

describe('bundle', () => {
  it('export → restore-all into an empty app → export is identical', () => {
    seedHistory();
    const exported = exportBundle(db);

    const other = openDatabase(':memory:');
    try {
      importBundle(other, roundTrip(exported), 'restore-all');
      expect(withoutDate(exportBundle(other))).toEqual(withoutDate(exported));
    } finally {
      other.close();
    }
  });

  it('restore-all replaces every existing template', () => {
    seedHistory();
    const backup = roundTrip(exportBundle(db));
    createTemplate(db, 'Made after the backup', resumeFor('Z'));

    importBundle(db, backup, 'restore-all');

    expect(listTemplates(db).map((t) => t.name)).toEqual(['Backend CV', 'Frontend CV']);
    expect(withoutDate(exportBundle(db))).toEqual(withoutDate(backup));
  });

  it('as-new-template adds copies under fresh ids and keeps what is there', () => {
    seedHistory();
    const [backend] = listTemplates(db);
    const bundle = roundTrip(exportBundle(db, [backend.id]));

    const { templateIds } = importBundle(db, bundle, 'as-new-template');

    expect(templateIds).toHaveLength(1);
    const [copyId] = templateIds;
    expect(copyId).not.toBe(backend.id);
    expect(listTemplates(db).map((t) => t.name)).toEqual([
      'Backend CV',
      'Frontend CV',
      'Backend CV',
    ]);

    // Same history and draft, none of the same ids, parents relinked to the new ids.
    const originals = listVersions(db, backend.id);
    const copies = listVersions(db, copyId);
    expect(copies.map((v) => v.summary)).toEqual(originals.map((v) => v.summary));
    expect(copies.some((v) => originals.some((o) => o.id === v.id))).toBe(false);
    const copyIds = new Set(copies.map((v) => v.id));
    for (const v of copies) if (v.parentId !== null) expect(copyIds.has(v.parentId)).toBe(true);
    expect(readDraft(db, copyId)).toEqual({ ...readDraft(db, backend.id), templateId: copyId });
  });

  it('an import that fails part-way changes nothing', () => {
    seedHistory();
    const before = exportBundle(db);
    const bundle = roundTrip(exportBundle(db));
    // Two templates claiming the same version id: the second insert violates the key.
    bundle.templates[1].versions[0].id = bundle.templates[0].versions[0].id;

    expect(() => importBundle(db, bundle, 'restore-all')).toThrow(/UNIQUE constraint failed/);
    expect(withoutDate(exportBundle(db))).toEqual(withoutDate(before));
  });
});
