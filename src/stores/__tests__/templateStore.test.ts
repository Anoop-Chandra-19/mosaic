import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultResume, createEmptyResume } from '@/lib/resume/defaultResume';
import type { MosaicDb, MosaicDbBridge } from '@/types/db';
// The real main-process database code over SQLite in memory: these flows run against
// what the app runs, minus the IPC hop.
import { openDatabase, type Database } from '../../../electron/main/db/connection';
import { createDbHandlers, settle } from '../../../electron/main/ipc/dbHandlers';

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
    resume().updateContact({ name: 'Ada Lovelace' });

    await templates().createTemplate('Frontend', createEmptyResume());
    expect(resume().contact.name).toBe('');

    await templates().openTemplate(backend);
    expect(resume().contact.name).toBe('Ada Lovelace');
  });

  it('names a version, after which the draft matches it', async () => {
    await templates().createTemplate('Backend', createDefaultResume());
    resume().updateContact({ name: 'Ada' });
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
    resume().updateContact({ name: 'Unsaved edit' });
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
    resume().updateContact({ name: 'Recently edited' });
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

  it('duplicates with the latest edits', async () => {
    await templates().createTemplate('Backend', createDefaultResume());
    resume().updateContact({ name: 'Latest' });

    await templates().duplicateTemplate(resume().templateId!);

    const copy = templates().templates.find((t) => t.name === 'Backend (copy)')!;
    const draft = await db.current!.templates.open(copy.id);
    expect(draft.doc.contact.name).toBe('Latest');
  });

  it('rejects with the database error when main refuses', async () => {
    await expect(templates().openTemplate('missing')).rejects.toMatchObject({ code: 'not-found' });
  });
});
