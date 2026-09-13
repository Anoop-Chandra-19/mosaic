import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultResume } from '@/lib/resume/defaultResume';
import type { ResumeData } from '@/types/resume';

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
    store().updateContact({ name: 'A' });
    store().updateContact({ name: 'Ada' });
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
      store().updateContact({ phone: String(second) });
      await vi.advanceTimersByTimeAsync(900);
    }
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('flushes on demand and resolves once the save has landed', async () => {
    store().updateContact({ name: 'Grace' });
    await flushDraft();

    expect(save).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(5000);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('never saves a draft that came from main', async () => {
    store().updateContact({ name: 'Unsaved' });
    store().loadDraft({ templateId: 't2', doc: createDefaultResume(), rev: 9 });

    await vi.advanceTimersByTimeAsync(5000);
    await flushDraft();
    expect(save).not.toHaveBeenCalled();
    expect(store().rev).toBe(9);
  });

  it('does not save without an open template', async () => {
    store().loadDraft(null);
    store().updateContact({ name: 'Nobody' });

    await flushDraft();
    expect(save).not.toHaveBeenCalled();
  });

  it('shrugs off a superseded save but reports a real failure', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    save.mockRejectedValueOnce(new DbError('stale-rev', 'older than stored'));
    store().updateContact({ name: 'x' });
    await flushDraft();
    expect(store().saveFailed).toBe(false);

    save.mockRejectedValueOnce(new DbError('internal', 'disk full'));
    store().updateContact({ name: 'y' });
    await flushDraft();
    expect(store().saveFailed).toBe(true);

    store().updateContact({ name: 'z' });
    await flushDraft();
    expect(store().saveFailed).toBe(false);
    error.mockRestore();
  });
});
