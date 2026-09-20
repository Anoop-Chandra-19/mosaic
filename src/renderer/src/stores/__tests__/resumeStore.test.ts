import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultResume } from '@shared/resume/defaultResume';
import type { ResumeData } from '@shared/types/resume';

const save = vi.hoisted(() =>
  vi.fn<(templateId: string, doc: ResumeData, rev: number) => Promise<void>>(async () => {})
);
vi.mock('@/lib/storage/mosaicDb', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/storage/mosaicDb')>()),
  getDb: () => ({ drafts: { save } }),
}));

const { DbError } = await import('@/lib/storage/mosaicDb');
const { flushDraft, useResumeStore } = await import('../resumeStore');

const store = () => useResumeStore.getState();

beforeEach(() => {
  vi.useFakeTimers();
  save.mockClear();
  store().loadDraft({ templateId: 't1', doc: createDefaultResume(), rev: 4 });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('resumeStore saving', () => {
  it('bumps the rev on every edit and saves once typing pauses', async () => {
    store().setName('A');
    store().setName('Ada');
    expect(store().rev).toBe(6);

    await vi.advanceTimersByTimeAsync(999);
    expect(save).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledTimes(1);
    const [templateId, doc, rev] = save.mock.calls[0];
    expect([templateId, doc.contact.name, rev]).toEqual(['t1', 'Ada', 6]);
  });

  it('saves during non-stop edits at least every five seconds', async () => {
    for (let second = 0; second < 6; second++) {
      store().setName(String(second));
      await vi.advanceTimersByTimeAsync(900);
    }
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('flushes on demand and resolves once the save has landed', async () => {
    store().setName('Grace');
    await flushDraft();

    expect(save).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(5000);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('never saves a draft that came from main', async () => {
    store().setName('Unsaved');
    store().loadDraft({ templateId: 't2', doc: createDefaultResume(), rev: 9 });

    await vi.advanceTimersByTimeAsync(5000);
    await flushDraft();
    expect(save).not.toHaveBeenCalled();
    expect(store().rev).toBe(9);
  });

  it('does not save without an open template', async () => {
    store().loadDraft(null);
    store().setName('Nobody');

    await flushDraft();
    expect(save).not.toHaveBeenCalled();
  });

  it('shrugs off a superseded save but reports a real failure', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    save.mockRejectedValueOnce(new DbError('stale-rev', 'older than stored'));
    store().setName('x');
    await flushDraft();
    expect(store().saveFailed).toBe(false);

    save.mockRejectedValueOnce(new DbError('internal', 'disk full'));
    store().setName('y');
    await flushDraft();
    expect(store().saveFailed).toBe(true);

    store().setName('z');
    await flushDraft();
    expect(store().saveFailed).toBe(false);
    error.mockRestore();
  });
});

describe('resumeStore header', () => {
  const lines = () => store().contact.header.lines;
  const itemIds = () => lines().map((line) => line.items.map((item) => item.id));

  it('adds, edits, and removes lines and items', () => {
    const lineId = store().addHeaderLine();
    const itemId = store().addHeaderItem(lineId, 'github');
    store().updateHeaderItem(itemId, { text: 'github.com/ada', url: 'github.com/ada' });
    store().updateHeaderLine(lineId, { separator: ' · ', align: 'left' });

    expect(lines()[2]).toMatchObject({
      separator: ' · ',
      align: 'left',
      items: [{ kind: 'github', text: 'github.com/ada', url: 'github.com/ada', shown: true }],
    });

    store().removeHeaderItem(itemId);
    expect(lines()[2].items).toEqual([]);
    store().removeHeaderLine(lineId);
    expect(lines()).toHaveLength(2);
  });

  it('keeps a hidden item and its link', () => {
    store().updateHeaderItem('head-linkedin', { shown: false });
    expect(lines()[0].items[2]).toMatchObject({ url: 'linkedin.com/in/you', shown: false });
  });

  it('moves items within a line, between lines, and moves lines', () => {
    store().moveHeaderItem('head-email', -1);
    store().moveHeaderItem('head-email', -1);
    expect(itemIds()[0]).toEqual(['head-email', 'head-phone', 'head-linkedin']);

    store().moveHeaderItemToLine('head-linkedin', 'head-status');
    expect(itemIds()).toEqual([
      ['head-email', 'head-phone'],
      ['head-auth', 'head-location', 'head-linkedin'],
    ]);

    store().moveHeaderLine('head-status', -1);
    expect(lines().map((line) => line.id)).toEqual(['head-status', 'head-reach']);
  });

  it('duplicates an item beside itself with its own id', () => {
    store().duplicateHeaderItem('head-phone');
    const [phone, copy] = lines()[0].items;
    expect(copy).toEqual({ ...phone, id: copy.id });
    expect(copy.id).not.toBe(phone.id);
  });

  it('sets the link style for the whole header', () => {
    store().setLinkStyle('underline');
    expect(store().contact.header.linkStyle).toBe('underline');
  });
});

describe('resumeStore sections, entries, and bullets', () => {
  const section = (id: string) => store().sections.find((s) => s.id === id)!;
  const job = () => section('sec-experience').items[0];

  it('leaves a whole section off and puts it back, keeping its entries’ choices', () => {
    store().toggleEntry('sec-education', 'edu2');
    store().toggleSection('sec-education');
    expect(section('sec-education').hidden).toBe(true);

    store().toggleSection('sec-education');
    // Back on the resume is the default, so the flag goes rather than turning false.
    expect(section('sec-education')).not.toHaveProperty('hidden');
    expect(section('sec-education').items.map((e) => e.selected)).toEqual([true, false]);
  });

  it('duplicates an entry right below it, bullets and all, with new ids', () => {
    const original = job();
    store().duplicateEntry('sec-experience', original.id);

    const [first, copy] = section('sec-experience').items;
    expect(first.id).toBe(original.id);
    expect(copy.id).not.toBe(original.id);
    expect(copy.title).toBe(original.title);
    expect(copy.bullets.map((b) => b.text)).toEqual(original.bullets.map((b) => b.text));
    for (const [index, bullet] of copy.bullets.entries()) {
      expect(bullet.id).not.toBe(original.bullets[index].id);
    }
  });

  it('duplicates and moves a bullet within its entry', () => {
    const [a, b] = job().bullets;
    store().duplicateBullet('sec-experience', job().id, a.id);
    expect(
      job()
        .bullets.map((x) => x.text)
        .slice(0, 3)
    ).toEqual([a.text, a.text, b.text]);
    const copyId = job().bullets[1].id;
    expect(copyId).not.toBe(a.id);

    store().moveBullet('sec-experience', job().id, b.id, -1);
    expect(
      job()
        .bullets.map((x) => x.id)
        .slice(0, 3)
    ).toEqual([a.id, b.id, copyId]);
    // Nothing moves past either end.
    store().moveBullet('sec-experience', job().id, a.id, -1);
    expect(job().bullets[0].id).toBe(a.id);
  });
});

describe('resumeStore undo and redo', () => {
  const job = () => store().sections.find((s) => s.id === 'sec-experience')!.items[0];

  it('takes back a change and puts it back, naming each step', () => {
    const before = job().bullets.length;
    store().removeBullet('sec-experience', job().id, job().bullets[0].id);
    expect([store().undoLabel, store().redoLabel]).toEqual(['delete a bullet', null]);

    store().undo();
    expect(job().bullets).toHaveLength(before);
    expect([store().undoLabel, store().redoLabel]).toEqual([null, 'delete a bullet']);

    store().redo();
    expect(job().bullets).toHaveLength(before - 1);
    expect([store().undoLabel, store().redoLabel]).toEqual(['delete a bullet', null]);
  });

  it('does nothing at either end of the history', () => {
    const rev = store().rev;
    store().undo();
    store().redo();
    expect(store().rev).toBe(rev);
    expect([store().undoLabel, store().redoLabel]).toEqual([null, null]);
  });

  it('walks back through every step in order', () => {
    store().setName('Ada');
    store().addSection({ kind: 'custom', layout: 'entries', label: 'Awards' });
    store().setName('Grace');

    expect(store().undoLabel).toBe('edit the name');
    store().undo();
    expect([store().contact.name, store().undoLabel]).toEqual(['Ada', 'add a section']);
    store().undo();
    expect(store().sections.some((s) => s.label === 'Awards')).toBe(false);
    store().undo();
    expect(store().contact.name).toBe(createDefaultResume().contact.name);
    expect(store().undoLabel).toBeNull();
  });

  it('bumps the rev and saves, so an undo is on disk like any other change', async () => {
    store().setName('Ada');
    await flushDraft();
    const saved = store().rev;

    store().undo();
    expect(store().rev).toBe(saved + 1);
    await flushDraft();
    const [, doc, rev] = save.mock.calls.at(-1)!;
    expect([doc.contact.name, rev]).toEqual([createDefaultResume().contact.name, saved + 1]);
  });

  it('drops what was undone once a new change is made', () => {
    store().setName('Ada');
    store().undo();
    expect(store().redoLabel).toBe('edit the name');

    store().setName('Grace');
    expect(store().redoLabel).toBeNull();
    store().undo();
    expect(store().contact.name).toBe(createDefaultResume().contact.name);
  });

  it('starts again for the next draft', () => {
    store().setName('Ada');
    store().loadDraft({ templateId: 't2', doc: createDefaultResume(), rev: 9 });
    expect([store().undoLabel, store().redoLabel]).toEqual([null, null]);

    store().undo();
    expect(store().rev).toBe(9);
  });

  it('takes back an import or a restore as one step, with the steps before it intact', () => {
    const fromTheFile: ResumeData = {
      ...createDefaultResume(),
      contact: { ...createDefaultResume().contact, name: 'From the file' },
    };
    store().setName('Ada');

    store().loadDraft({ templateId: 't1', doc: fromTheFile, rev: 20 }, { asStep: 'import' });
    expect(store().contact.name).toBe('From the file');
    // Main wrote a version holding this document, so the draft matches it.
    expect([store().undoLabel, store().changesSinceBaseline, store().baselineRev]).toEqual([
      'import',
      0,
      20,
    ]);

    store().undo();
    expect([store().contact.name, store().changesSinceBaseline]).toEqual(['Ada', -1]);
    // The editing that happened before the import is still there to walk back through.
    expect(store().undoLabel).toBe('edit the name');
    store().redo();
    expect(store().contact.name).toBe('From the file');
  });

  it('counts the steps between the draft and the newest version, either way', () => {
    expect([store().changesSinceBaseline, store().baselineRev]).toEqual([0, 4]);

    store().setName('Ada');
    store().setName('Grace');
    expect(store().changesSinceBaseline).toBe(2);

    // A version named here is what the count runs from from now on.
    store().markVersionSaved(store().rev);
    store().setName('Hopper');
    expect(store().changesSinceBaseline).toBe(1);

    store().undo();
    expect(store().changesSinceBaseline).toBe(0);
    store().undo();
    // A step further back than that version: the count says which way it went.
    expect([store().contact.name, store().changesSinceBaseline]).toEqual(['Ada', -1]);
    expect(store().baselineReachable).toBe(true);

    // A new step drops the ones that were undone, the version's own among them.
    store().setName('Hedy');
    expect(store().baselineReachable).toBe(false);

    store().markVersionSaved(store().rev);
    expect([store().changesSinceBaseline, store().baselineReachable]).toEqual([0, true]);
  });

  it('remembers a hundred steps, and lets go of the oldest', () => {
    for (let step = 0; step < 120; step++) store().setName(`Name ${step}`);
    for (let step = 0; step < 120; step++) store().undo();

    // The first twenty are gone, so the name is as it was at the twentieth step.
    expect(store().contact.name).toBe('Name 19');
    expect(store().undoLabel).toBeNull();
  });
});
