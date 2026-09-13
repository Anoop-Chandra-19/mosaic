import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { getDb } from '@/lib/storage/mosaicDb';
import { flushDraft, useResumeStore } from '@/stores/resumeStore';
import type { Draft, TemplateSummary, VersionMeta } from '@/types/db';
import type { PendingTextAiChange, ResumeData } from '@/types/resume';

/*
 * Templates as main stores them. The list is summaries only — documents stay in the
 * database until a template is opened into the editor (`resumeStore`), which also knows
 * which template is open. Actions write through main and then re-read the list, so it
 * never drifts from what is on disk. They reject with a `DbError` if main refuses.
 */

interface TemplateState {
  templates: TemplateSummary[];
  pendingAiChanges: PendingTextAiChange[];

  load: (templates: TemplateSummary[]) => void;
  refresh: () => Promise<void>;

  /** Adds a template and opens it. `importedFrom` names an import's source for history. */
  createTemplate: (name: string, doc: ResumeData, importedFrom?: string) => Promise<void>;
  openTemplate: (id: string) => Promise<void>;
  renameTemplate: (id: string, name: string) => Promise<void>;
  duplicateTemplate: (id: string) => Promise<void>;
  /** The open one included: the most recently edited opens next, or nothing does. */
  deleteTemplate: (id: string) => Promise<void>;
  deleteAllTemplates: () => Promise<void>;

  /** Names what is in the editor — see `MosaicDb['versions']['name']`. */
  nameVersion: (name: string) => Promise<VersionMeta>;
  /** Replaces the open draft, keeping unsaved edits in history first. */
  importIntoDraft: (doc: ResumeData, from: string) => Promise<void>;

  // AI queue (T3, exposed now for interface stability)
  enqueueAiChange: (change: PendingTextAiChange) => void;
  keepAiChange: (changeId: string) => void;
  undoAiChange: (changeId: string) => void;
  keepAllAiChanges: () => void;
  undoAllAiChanges: () => void;
  clearAiChanges: () => void;
}

function openTemplateId(): string | null {
  return useResumeStore.getState().templateId;
}

function requireOpenTemplate(): string {
  const id = openTemplateId();
  if (id === null) throw new Error('No template is open');
  return id;
}

function revertAiChange(change: PendingTextAiChange) {
  const { target, before } = change;
  const resume = useResumeStore.getState();
  if (target.kind === 'bullet-text') {
    resume.updateBullet(target.sectionId, target.entryId, target.bulletId, before);
  } else {
    resume.updateEntry(target.sectionId, target.entryId, { text: before });
  }
}

export const useTemplateStore = create<TemplateState>()(
  immer((set, get) => {
    /** Put a draft from main in the editor; staged AI changes pointed at the old one. */
    const showDraft = (draft: Draft | null) => {
      set((state) => {
        state.pendingAiChanges = [];
      });
      useResumeStore.getState().loadDraft(draft);
    };

    return {
      templates: [],
      pendingAiChanges: [],

      load: (templates) =>
        set((state) => {
          state.templates = templates;
        }),

      refresh: async () => {
        const templates = await getDb().templates.list();
        set((state) => {
          state.templates = templates;
        });
      },

      createTemplate: async (name, doc, importedFrom) => {
        await flushDraft();
        const db = getDb();
        const created = await db.templates.create(name, doc, importedFrom);
        showDraft(await db.templates.open(created.id));
        await get().refresh();
      },

      openTemplate: async (id) => {
        if (id === openTemplateId()) return;
        await flushDraft();
        showDraft(await getDb().templates.open(id));
        // The template left behind may have just saved; its summary is out of date.
        await get().refresh();
      },

      renameTemplate: async (id, name) => {
        await getDb().templates.rename(id, name);
        await get().refresh();
      },

      duplicateTemplate: async (id) => {
        // The copy takes the draft as main has it, so send the latest edits first.
        await flushDraft();
        await getDb().templates.duplicate(id);
        await get().refresh();
      },

      deleteTemplate: async (id) => {
        await getDb().templates.remove(id);
        await get().refresh();
        if (id !== openTemplateId()) return;

        const next = get().templates.reduce<TemplateSummary | undefined>(
          (latest, t) => (latest && latest.updatedAt >= t.updatedAt ? latest : t),
          undefined
        );
        if (next) {
          showDraft(await getDb().templates.open(next.id));
        } else {
          showDraft(null);
        }
      },

      deleteAllTemplates: async () => {
        const db = getDb();
        for (const template of get().templates) await db.templates.remove(template.id);
        showDraft(null);
        await get().refresh();
      },

      nameVersion: async (name) => {
        const templateId = requireOpenTemplate();
        await flushDraft();
        const version = await getDb().versions.name(templateId, name);
        await get().refresh();
        return version;
      },

      importIntoDraft: async (doc, from) => {
        const templateId = requireOpenTemplate();
        await flushDraft();
        showDraft(await getDb().drafts.importInto(templateId, doc, from));
        await get().refresh();
      },

      // AI queue (T3, stubs wired for interface stability)

      enqueueAiChange: (change) =>
        set((state) => {
          state.pendingAiChanges.push(change);
        }),

      keepAiChange: (changeId) =>
        set((state) => {
          state.pendingAiChanges = state.pendingAiChanges.filter((c) => c.id !== changeId);
        }),

      undoAiChange: (changeId) => {
        const change = get().pendingAiChanges.find((c) => c.id === changeId);
        if (!change) return;
        revertAiChange(change);
        set((state) => {
          state.pendingAiChanges = state.pendingAiChanges.filter((c) => c.id !== changeId);
        });
      },

      keepAllAiChanges: () =>
        set((state) => {
          state.pendingAiChanges = [];
        }),

      undoAllAiChanges: () => {
        for (const change of [...get().pendingAiChanges].reverse()) revertAiChange(change);
        set((state) => {
          state.pendingAiChanges = [];
        });
      },

      clearAiChanges: () =>
        set((state) => {
          state.pendingAiChanges = [];
        }),
    };
  })
);
