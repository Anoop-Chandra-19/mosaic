import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultResume, createEmptyResume } from '@shared/resume/defaultResume';
import type { MosaicDb, MosaicDbBridge } from '@shared/types/db';
// The real main-process database code over SQLite in memory: these flows run against
// what the app runs, minus the IPC hop.
import { openDatabase, type Database } from '../../../../main/db/connection';
import { createDbHandlers, settle } from '../../../../main/ipc/dbHandlers';

const db = vi.hoisted(() => ({ current: undefined as MosaicDb | undefined }));
vi.mock('@/lib/storage/mosaicDb', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/storage/mosaicDb')>()),
  getDb: () => db.current,
}));

const { unwrapBridge } = await import('@/lib/storage/mosaicDb');
const { flushDraft, useResumeStore } = await import('../resumeStore');
const { useTemplateStore } = await import('../templateStore');

let sqlite: Database;

/** A bridge that answers the way main does, straight from the handlers. */
function inProcessBridge(handlers: object): MosaicDbBridge {
  const wrap = (node: object): object =>
    Object.fromEntries(
      Object.entries(node).map(([key, value]) => [
        key,
        typeof value === 'function'
          ? async (...args: unknown[]) => settle(() => value(...args))
          : wrap(value),
      ])
    );
  return wrap(handlers) as MosaicDbBridge;
}

const templates = () => useTemplateStore.getState();
const resume = () => useResumeStore.getState();
const names = () => templates().templates.map((t) => t.name);

beforeEach(() => {
  sqlite = openDatabase(':memory:');
  db.current = unwrapBridge(inProcessBridge(createDbHandlers(sqlite)));
  templates().load([]);
  resume().loadDraft(null);
});

afterEach(() => {
  sqlite.close();
});

describe('templateStore', () => {
  it('creates a template and opens its draft', async () => {
    await templates().createTemplate('Backend', createDefaultResume());

    expect(names()).toEqual(['Backend']);
    expect(resume().templateId).toBe(templates().templates[0].id);
    expect(resume().contact.name).toBe('Your Name');
  });

  it('saves pending edits before switching, and switching back finds them', async () => {
    await templates().createTemplate('Backend', createDefaultResume());
    const backend = resume().templateId!;
    resume().setName('Ada Lovelace');

    await templates().createTemplate('Frontend', createEmptyResume());
    expect(resume().contact.name).toBe('');

    await templates().openTemplate(backend);
    expect(resume().contact.name).toBe('Ada Lovelace');
  });

  it('names a version, after which the draft matches it', async () => {
    await templates().createTemplate('Backend', createDefaultResume());
    resume().setName('Ada');
    await flushDraft();

    const version = await templates().nameVersion('Sent to Striped');

    const [summary] = templates().templates;
    expect(summary.head).toMatchObject({
      id: version.id,
      kind: 'named',
      summary: 'Sent to Striped',
    });
    expect(summary.head.rev).toBe(resume().rev);
  });

  it('imports over the draft and keeps unsaved edits in history', async () => {
    await templates().createTemplate('Backend', createDefaultResume());
    resume().setName('Unsaved edit');
    const imported = createEmptyResume();
    imported.contact.name = 'Imported';

    await templates().importIntoDraft(imported, 'pasted text');

    expect(resume().contact.name).toBe('Imported');
    const history = await db.current!.versions.list(resume().templateId!);
    expect(history.map((v) => v.summary)).toEqual([
      'Imported from pasted text',
      'Before importing pasted text',
      'Created',
    ]);
  });

  it('deleting the open template opens the most recently edited one', async () => {
    await templates().createTemplate('Backend', createDefaultResume());
    await templates().createTemplate('Frontend', createDefaultResume());
    const frontend = resume().templateId!;
    const backend = templates().templates.find((t) => t.name === 'Backend')!.id;
    await templates().openTemplate(backend);
    resume().setName('Recently edited');
    await flushDraft();
    await templates().openTemplate(frontend);

    await templates().deleteTemplate(frontend);

    expect(names()).toEqual(['Backend']);
    expect(resume().templateId).toBe(backend);
    expect(resume().contact.name).toBe('Recently edited');
  });

  it('deleting the last template leaves nothing open', async () => {
    await templates().createTemplate('Backend', createDefaultResume());

    await templates().deleteTemplate(resume().templateId!);

    expect(names()).toEqual([]);
    expect(resume().templateId).toBeNull();
    expect(resume().sections).toEqual([]);
  });

  it('undoing a delete brings the template back with its history and unsaved edits', async () => {
    await templates().createTemplate('Backend', createDefaultResume());
    await templates().nameVersion('Sent to Acme');
    await templates().createTemplate('Frontend', createEmptyResume());
    const frontend = resume().templateId!;
    resume().setName('Not saved yet');

    const deleted = await templates().deleteTemplate(frontend);
    expect(names()).toEqual(['Backend']);
    expect(resume().contact.name).toBe('Your Name');

    await templates().restoreDeleted(deleted);
    expect(names()).toEqual(['Backend', 'Frontend']);
    // It was open, so it opens again, as it was.
    expect(resume().templateId).toBe(templates().templates[1].id);
    expect(resume().contact.name).toBe('Not saved yet');
    expect(templates().templates[1].versionCount).toBe(1);
  });

  it('restoring a backup of this app replaces everything and keeps the open template open', async () => {
    await templates().createTemplate('Backend', createDefaultResume());
    const backend = resume().templateId!;
    const backup = JSON.stringify(await db.current!.bundle.export());
    resume().setName('After the backup');
    await templates().createTemplate('Frontend', createEmptyResume());
    await templates().openTemplate(backend);

    await templates().importBundle(backup, 'restore-all');

    expect(names()).toEqual(['Backend']);
    expect(resume().templateId).toBe(backend);
    expect(resume().contact.name).toBe('Your Name');
  });

  it('adding a backup’s templates opens one only when nothing is open', async () => {
    await templates().createTemplate('Backend', createDefaultResume());
    const backup = JSON.stringify(await db.current!.bundle.export());
    const backend = resume().templateId!;

    await templates().importBundle(backup, 'as-new-template');
    expect(names()).toEqual(['Backend', 'Backend']);
    expect(resume().templateId).toBe(backend);

    await templates().deleteTemplate(templates().templates[0].id);
    await templates().deleteTemplate(templates().templates[0].id);
    const [added] = await templates().importBundle(backup, 'as-new-template');
    expect(resume().templateId).toBe(added);
  });

  it('duplicates with the latest edits', async () => {
    await templates().createTemplate('Backend', createDefaultResume());
    resume().setName('Latest');

    await templates().duplicateTemplate(resume().templateId!);

    const copy = templates().templates.find((t) => t.name === 'Backend (copy)')!;
    const draft = await db.current!.templates.open(copy.id);
    expect(draft.doc.contact.name).toBe('Latest');
  });

  it('restores an older version, keeping unsaved edits in history', async () => {
    await templates().createTemplate('Backend', createDefaultResume());
    const templateId = resume().templateId!;
    resume().setName('Named state');
    const named = await templates().nameVersion('First');
    resume().setName('Unsaved edit');

    await templates().restoreVersion(templateId, named.id);

    expect(resume().contact.name).toBe('Named state');
    const history = await db.current!.versions.list(templateId);
    expect(history.slice(0, 2).map((v) => v.summary)).toEqual([
      'Restored "First"',
      'Before restoring "First"',
    ]);
  });

  it('restoring a version of another template opens that template', async () => {
    await templates().createTemplate('Backend', createDefaultResume());
    const backend = resume().templateId!;
    const [created] = await db.current!.versions.list(backend);
    await templates().createTemplate('Frontend', createEmptyResume());

    await templates().restoreVersion(backend, created.id);

    expect(resume().templateId).toBe(backend);
  });

  it('duplicates one version as a new template, leaving the open one open', async () => {
    await templates().createTemplate('Backend', createDefaultResume());
    const templateId = resume().templateId!;
    const [created] = await db.current!.versions.list(templateId);
    resume().setName('Later edit');

    const copy = await templates().duplicateVersion(created.id);

    expect(resume().templateId).toBe(templateId);
    const draft = await db.current!.templates.open(copy.id);
    expect(draft.doc.contact.name).toBe('Your Name');
  });

  it('rejects with the database error when main refuses', async () => {
    await expect(templates().openTemplate('missing')).rejects.toMatchObject({ code: 'not-found' });
  });
});

describe('auto snapshots', () => {
  const history = () => db.current!.versions.list(resume().templateId!);

  it('keeps the draft as a version saying what changed, and counts from it', async () => {
    await templates().createTemplate('Backend', createDefaultResume());
    resume().setName('Ada Lovelace');

    await templates().snapshotOpenDraft();

    const [head] = await history();
    expect(head).toMatchObject({
      kind: 'auto',
      source: 'edit',
      summary: 'Changed the name',
      rev: resume().rev,
    });
    expect(templates().templates[0].head.id).toBe(head.id);
    expect(resume().changesSinceBaseline).toBe(0);
    expect(resume().baselineRev).toBe(resume().rev);
  });

  it('leaves the undo stack alone: the version stands and the edit still comes back', async () => {
    await templates().createTemplate('Backend', createDefaultResume());
    resume().setName('Ada Lovelace');
    await templates().snapshotOpenDraft();

    expect(resume().undoLabel).toBe('edit the name');
    resume().undo();

    expect(resume().contact.name).toBe('Your Name');
    expect((await history()).map((v) => v.summary)).toEqual(['Changed the name', 'Created']);
    expect(resume().changesSinceBaseline).toBe(-1);
  });

  it('writes nothing when there is nothing new to keep', async () => {
    await templates().createTemplate('Backend', createDefaultResume());
    resume().setName('Ada Lovelace');
    await templates().snapshotOpenDraft();

    await templates().snapshotOpenDraft();

    expect(await history()).toHaveLength(2);
  });

  it('keeps the draft it leaves when another template opens', async () => {
    await templates().createTemplate('Backend', createDefaultResume());
    const backend = resume().templateId!;
    await templates().createTemplate('Frontend', createEmptyResume());
    await templates().openTemplate(backend);
    resume().setName('Ada Lovelace');

    await templates().openTemplate(templates().templates.find((t) => t.name === 'Frontend')!.id);

    const kept = await db.current!.versions.list(backend);
    expect(kept.map((v) => v.summary)).toEqual(['Changed the name', 'Created']);
  });

  it('does nothing at all with no template open', async () => {
    await expect(templates().snapshotOpenDraft()).resolves.toBeUndefined();
  });
});
