import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultResume } from '@shared/resume/defaultResume';
import type { ResumeData } from '@shared/types/resume';
import { openDatabase, type Database } from '../connection';
import { readDraft, saveDraft } from '../drafts';
import { readBootState } from '../readBootState';
import { ACTIVE_TEMPLATE_KEY, getSetting, removeSetting, setSetting } from '../settings';
import {
  createTemplate,
  duplicateTemplate,
  duplicateVersion,
  getTemplate,
  listTemplates,
  openTemplate,
  removeTemplate,
  renameTemplate,
} from '../templates';
import {
  getVersion,
  importIntoDraft,
  headVersion,
  listVersions,
  nameDraft,
  restoreVersion,
  snapshotDraft,
  snapshotEditedDraft,
} from '../versions';

let db: Database;

beforeEach(() => {
  db = openDatabase(':memory:');
});

afterEach(() => {
  db.close();
  vi.useRealTimers();
});

/** The example resume under another name, so documents are easy to tell apart. */
function resumeFor(name: string): ResumeData {
  const doc = createDefaultResume();
  doc.contact.name = name;
  return doc;
}

const isClean = (templateId: string) =>
  getTemplate(db, templateId).rev === headVersion(db, templateId)!.rev;

function countRows(table: string, templateId: string): number {
  return db
    .prepare(`select count(*) from ${table} where template_id = ?`)
    .pluck()
    .get(templateId) as number;
}

describe('readBootState', () => {
  it('opens a new install empty: no templates, no draft', () => {
    expect(readBootState(db)).toEqual({ settings: {}, templates: [], draft: null });
    expect(listTemplates(db)).toEqual([]);
  });

  it('reopens the template that was active', () => {
    createTemplate(db, 'First', resumeFor('First'));
    const other = createTemplate(db, 'Other', resumeFor('Other'));
    openTemplate(db, other.id);

    const state = readBootState(db);
    expect(state.templates.map((t) => t.name)).toEqual(['First', 'Other']);
    expect(state.draft).toEqual({ templateId: other.id, doc: resumeFor('Other'), rev: 0 });
    expect(state.settings[ACTIVE_TEMPLATE_KEY]).toBe(other.id);
  });

  it('opens empty again once every template is deleted', () => {
    const { id } = createTemplate(db, 'Only', resumeFor('Only'));
    openTemplate(db, id);
    removeTemplate(db, id);

    const state = readBootState(db);
    expect(state.templates).toEqual([]);
    expect(state.draft).toBeNull();
    expect(state.settings[ACTIVE_TEMPLATE_KEY]).toBeUndefined();
  });

  it('falls back to the most recently edited template when the active one is gone', () => {
    vi.useFakeTimers({ now: 1_000 });
    const first = createTemplate(db, 'First', resumeFor('First'));
    vi.setSystemTime(2_000);
    createTemplate(db, 'Second', resumeFor('Second'));
    vi.setSystemTime(3_000);
    saveDraft(db, first.id, resumeFor('First, edited'), 1);
    setSetting(db, ACTIVE_TEMPLATE_KEY, 'deleted-template');

    expect(readBootState(db).draft?.templateId).toBe(first.id);
    expect(getSetting(db, ACTIVE_TEMPLATE_KEY)).toBe(first.id);
  });
});

describe('settings', () => {
  it('sets, overwrites, and removes a key', () => {
    expect(getSetting(db, 'mosaic-ui')).toBeNull();
    setSetting(db, 'mosaic-ui', '{"a":1}');
    setSetting(db, 'mosaic-ui', '{"a":2}');
    expect(getSetting(db, 'mosaic-ui')).toBe('{"a":2}');
    removeSetting(db, 'mosaic-ui');
    expect(getSetting(db, 'mosaic-ui')).toBeNull();
  });
});

describe('drafts', () => {
  it('saves the document and the renderer rev in one write', () => {
    const { id } = createTemplate(db, 'CV', resumeFor('A'));

    saveDraft(db, id, resumeFor('B'), 3);

    expect(readDraft(db, id)).toEqual({ templateId: id, doc: resumeFor('B'), rev: 3 });
    expect(getTemplate(db, id).rev).toBe(3);
  });

  it('refuses a save older than the stored rev', () => {
    const { id } = createTemplate(db, 'CV', resumeFor('A'));
    saveDraft(db, id, resumeFor('B'), 5);

    expect(() => saveDraft(db, id, resumeFor('stale'), 4)).toThrow(
      expect.objectContaining({ code: 'stale-rev' })
    );
    expect(readDraft(db, id).doc).toEqual(resumeFor('B'));
  });

  it('refuses a save for a template that does not exist', () => {
    expect(() => saveDraft(db, 'missing', resumeFor('A'), 1)).toThrow(
      expect.objectContaining({ code: 'not-found' })
    );
  });
});

describe('versions', () => {
  it('is clean exactly when the template rev matches the head version', () => {
    const { id } = createTemplate(db, 'CV', resumeFor('A'));
    expect(isClean(id)).toBe(true);

    saveDraft(db, id, resumeFor('B'), 1);
    expect(isClean(id)).toBe(false);

    nameDraft(db, id, 'Sent to Fastly');
    expect(isClean(id)).toBe(true);
  });

  it('naming a dirty draft adds a named version after the head', () => {
    const { id, head } = createTemplate(db, 'CV', resumeFor('A'));
    saveDraft(db, id, resumeFor('B'), 1);

    const named = nameDraft(db, id, 'Sent to Fastly');

    expect(named).toMatchObject({ kind: 'named', source: 'name', parentId: head.id, rev: 1 });
    expect(getVersion(db, named.id).doc).toEqual(resumeFor('B'));
    expect(listVersions(db, id).map((v) => v.id)).toEqual([named.id, head.id]);
  });

  it('naming a clean draft renames the head instead of adding a version', () => {
    const { id, head } = createTemplate(db, 'CV', resumeFor('A'));

    const named = nameDraft(db, id, 'Baseline');

    expect(named).toMatchObject({ id: head.id, kind: 'named', summary: 'Baseline' });
    expect(listVersions(db, id)).toEqual([named]);
  });

  it('treats edit-then-undo as clean when naming, and adopts the new rev', () => {
    const { id, head } = createTemplate(db, 'CV', resumeFor('A'));
    saveDraft(db, id, resumeFor('A'), 2); // rev moved, content did not

    const named = nameDraft(db, id, 'Baseline');

    expect(named).toMatchObject({ id: head.id, rev: 2 });
    expect(listVersions(db, id)).toHaveLength(1);
    expect(isClean(id)).toBe(true);
  });

  it('an auto snapshot of a clean draft returns the head without a new row', () => {
    const { id, head } = createTemplate(db, 'CV', resumeFor('A'));

    expect(
      snapshotDraft(db, { templateId: id, source: 'import', summary: 'Before import' })
    ).toEqual(head);
    expect(listVersions(db, id)).toHaveLength(1);
  });

  it('an auto snapshot of a dirty draft keeps it as a version', () => {
    const { id } = createTemplate(db, 'CV', resumeFor('A'));
    saveDraft(db, id, resumeFor('B'), 1);

    const snap = snapshotDraft(db, { templateId: id, source: 'import', summary: 'Before import' });

    expect(snap).toMatchObject({ kind: 'auto', source: 'import', rev: 1 });
    expect(getVersion(db, snap.id).doc).toEqual(resumeFor('B'));
    expect(isClean(id)).toBe(true);
  });

  it('an auto snapshot of edit-then-undo keeps no row, and the draft is clean again', () => {
    const { id, head } = createTemplate(db, 'CV', resumeFor('A'));
    saveDraft(db, id, resumeFor('A'), 4); // four steps out and back

    expect(snapshotEditedDraft(db, id, 'edit')).toMatchObject({ id: head.id, rev: 4 });
    expect(listVersions(db, id)).toHaveLength(1);
    expect(isClean(id)).toBe(true);
  });

  it('an auto snapshot while editing says what changed since the newest version', () => {
    const { id } = createTemplate(db, 'CV', resumeFor('A'));
    const edited = resumeFor('A');
    const experience = edited.sections.find((s) => s.kind === 'experience')!;
    experience.items[0].bullets[0].text = 'Shipped the thing, twice';

    saveDraft(db, id, edited, 1);
    const snap = snapshotEditedDraft(db, id, 'edit');

    expect(snap).toMatchObject({
      kind: 'auto',
      source: 'edit',
      rev: 1,
      summary: `Edited a bullet in ${experience.label}`,
      section: experience.label,
    });
    expect(getVersion(db, snap.id).doc).toEqual(edited);
    expect(listVersions(db, id)[0].section).toBe(experience.label);
    expect(isClean(id)).toBe(true);
  });

  it('a snapshot where editing stopped says so, rather than what changed', () => {
    const { id } = createTemplate(db, 'CV', resumeFor('A'));
    saveDraft(db, id, resumeFor('B'), 1);
    expect(snapshotEditedDraft(db, id, 'switched')).toMatchObject({
      source: 'switched',
      summary: 'Where you left it before switching templates',
      section: null,
    });

    saveDraft(db, id, resumeFor('C'), 2);
    expect(snapshotEditedDraft(db, id, 'closed')).toMatchObject({
      source: 'closed',
      summary: 'Where you left it',
    });
  });

  it('restore keeps unsaved edits, writes the draft, records the restore, and moves the rev', () => {
    const { id, head: created } = createTemplate(db, 'CV', resumeFor('A'));
    saveDraft(db, id, resumeFor('B'), 1);
    nameDraft(db, id, 'B');
    saveDraft(db, id, resumeFor('C, unsaved'), 2);

    const draft = restoreVersion(db, id, created.id);

    expect(draft).toEqual({ templateId: id, doc: resumeFor('A'), rev: 3 });
    expect(readDraft(db, id)).toEqual(draft);
    const [restored, before] = listVersions(db, id);
    expect(before).toMatchObject({ kind: 'auto', source: 'restore', rev: 2 });
    expect(getVersion(db, before.id).doc).toEqual(resumeFor('C, unsaved'));
    expect(restored).toMatchObject({
      kind: 'auto',
      source: 'restore',
      rev: 3,
      parentId: created.id,
    });
    expect(isClean(id)).toBe(true);
  });

  it('restoring the version a clean draft already matches changes nothing', () => {
    const { id, head } = createTemplate(db, 'CV', resumeFor('A'));

    expect(restoreVersion(db, id, head.id)).toEqual(readDraft(db, id));
    expect(listVersions(db, id)).toHaveLength(1);
    expect(getTemplate(db, id).rev).toBe(0);
  });

  it('will not restore a version from another template', () => {
    const a = createTemplate(db, 'A', resumeFor('A'));
    const b = createTemplate(db, 'B', resumeFor('B'));

    expect(() => restoreVersion(db, a.id, b.head.id)).toThrow(
      expect.objectContaining({ code: 'not-found' })
    );
    expect(readDraft(db, a.id).doc).toEqual(resumeFor('A'));
  });

  it('importing over a dirty draft keeps it, then records the import', () => {
    const { id } = createTemplate(db, 'CV', resumeFor('A'));
    saveDraft(db, id, resumeFor('A, unsaved'), 4);

    const draft = importIntoDraft(db, id, resumeFor('From DOCX'), 'platform-resume.docx');

    expect(draft).toEqual({ templateId: id, doc: resumeFor('From DOCX'), rev: 5 });
    expect(readDraft(db, id)).toEqual(draft);
    const [imported, before] = listVersions(db, id);
    expect(before).toMatchObject({
      source: 'import',
      summary: 'Before importing platform-resume.docx',
      rev: 4,
    });
    expect(getVersion(db, before.id).doc).toEqual(resumeFor('A, unsaved'));
    expect(imported).toMatchObject({
      kind: 'auto',
      source: 'import',
      summary: 'Imported from platform-resume.docx',
      parentId: before.id,
      rev: 5,
    });
    expect(isClean(id)).toBe(true);
  });

  it('importing over a clean draft adds only the import', () => {
    const { id, head } = createTemplate(db, 'CV', resumeFor('A'));

    importIntoDraft(db, id, resumeFor('Pasted'), 'pasted text');

    const versions = listVersions(db, id);
    expect(versions.map((v) => v.summary)).toEqual(['Imported from pasted text', 'Created']);
    expect(versions[0].parentId).toBe(head.id);
  });
});

describe('templates', () => {
  it('records where an imported template came from', () => {
    const { head } = createTemplate(db, 'Platform', resumeFor('A'), 'platform-resume.pdf');
    expect(head).toMatchObject({
      kind: 'auto',
      source: 'import',
      summary: 'Imported from platform-resume.pdf',
    });
  });

  it('renames without touching the document', () => {
    const { id } = createTemplate(db, 'CV', resumeFor('A'));
    renameTemplate(db, id, 'Backend CV');
    expect(getTemplate(db, id).name).toBe('Backend CV');
    expect(() => renameTemplate(db, 'missing', 'x')).toThrow(
      expect.objectContaining({ code: 'not-found' })
    );
  });

  it('duplicates the current draft, unsaved edits included, without the history', () => {
    const source = createTemplate(db, 'CV', resumeFor('A'));
    saveDraft(db, source.id, resumeFor('A, unsaved'), 1);
    nameDraft(db, source.id, 'v1');

    const copy = duplicateTemplate(db, source.id);

    expect(copy).toMatchObject({ name: 'CV (copy)', rev: 0, versionCount: 1 });
    expect(copy.head).toMatchObject({ source: 'duplicate', summary: 'Duplicated from "CV"' });
    expect(readDraft(db, copy.id).doc).toEqual(resumeFor('A, unsaved'));
    expect(listTemplates(db).map((t) => t.id)).toEqual([source.id, copy.id]);
  });

  it('duplicates one version from the history instead of the draft', () => {
    const source = createTemplate(db, 'CV', resumeFor('A'));
    saveDraft(db, source.id, resumeFor('B'), 1);
    const named = nameDraft(db, source.id, 'Sent to Striped');
    saveDraft(db, source.id, resumeFor('C, unsaved'), 2);

    const copy = duplicateVersion(db, named.id);

    expect(copy).toMatchObject({ name: 'CV (copy)', versionCount: 1 });
    expect(copy.head).toMatchObject({
      source: 'duplicate',
      summary: 'Duplicated from "CV", version "Sent to Striped"',
    });
    expect(readDraft(db, copy.id).doc).toEqual(resumeFor('B'));
    expect(() => duplicateVersion(db, 'missing')).toThrow(
      expect.objectContaining({ code: 'not-found' })
    );
  });

  it('deleting a template cascades to its draft and versions', () => {
    const keep = createTemplate(db, 'Keep', resumeFor('Keep'));
    const doomed = createTemplate(db, 'Doomed', resumeFor('Doomed'));
    saveDraft(db, doomed.id, resumeFor('Doomed 2'), 1);
    nameDraft(db, doomed.id, 'v2');
    openTemplate(db, doomed.id);

    removeTemplate(db, doomed.id);

    expect(listTemplates(db).map((t) => t.id)).toEqual([keep.id]);
    expect(countRows('drafts', doomed.id)).toBe(0);
    expect(countRows('versions', doomed.id)).toBe(0);
    expect(countRows('versions', keep.id)).toBe(1);
    expect(getSetting(db, ACTIVE_TEMPLATE_KEY)).toBeNull();
  });

  it('can delete the last template', () => {
    const { id } = createTemplate(db, 'Only', resumeFor('Only'));
    removeTemplate(db, id);
    expect(listTemplates(db)).toEqual([]);
    expect(() => removeTemplate(db, id)).toThrow(expect.objectContaining({ code: 'not-found' }));
  });

  it('opening a template remembers it as active', () => {
    const { id } = createTemplate(db, 'CV', resumeFor('A'));
    removeSetting(db, ACTIVE_TEMPLATE_KEY);
    expect(openTemplate(db, id).doc).toEqual(resumeFor('A'));
    expect(getSetting(db, ACTIVE_TEMPLATE_KEY)).toBe(id);
  });
});
