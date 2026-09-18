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
