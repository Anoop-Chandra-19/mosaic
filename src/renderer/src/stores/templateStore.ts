import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { getDb } from '@/lib/storage/mosaicDb';
import { useOverlayStore } from '@/stores/overlayStore';
import { flushDraft, useResumeStore } from '@/stores/resumeStore';
import type { ImportMode, MosaicBundle } from '@shared/types/bundle';
import type { Draft, TemplateSummary, VersionMeta } from '@shared/types/db';
import type { PendingTextAiChange, ResumeData } from '@shared/types/resume';

/** A deleted template, kept in memory as a backup of just itself so it can be put back. */
export interface DeletedTemplate {
  bundle: MosaicBundle;
  /** It was in the editor. */
  wasOpen: boolean;
}

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
  /** Copies the draft into a new template. Does not open the copy. */
  duplicateTemplate: (id: string) => Promise<TemplateSummary>;
  /** A new template from one version of any template's history. Does not open it. */
  duplicateVersion: (versionId: string) => Promise<TemplateSummary>;
  /**
   * The open one included: the most recently edited opens next, or nothing does. Resolves
   * with what was deleted, which `restoreDeleted` puts back.
   */
  deleteTemplate: (id: string) => Promise<DeletedTemplate>;
  /** Undo for a delete: the template returns with its history, and reopens if it was open. */
  restoreDeleted: (deleted: DeletedTemplate) => Promise<void>;
  /**
   * Writes a backup file's templates and returns their ids. Opens one if the open template
   * went (restoring replaces everything) or nothing was open.
   */
  importBundle: (text: string, mode: ImportMode) => Promise<string[]>;

  /** Names what is in the editor — see `MosaicDb['versions']['name']`. */
  nameVersion: (name: string) => Promise<VersionMeta>;
  /**
   * Keeps what is in the editor as an auto version, so this much survives quitting. Taken
   * while editing (`useAutoSnapshot`), when another template opens, and on the way out.
   * The undo stack stays as it is. Nothing to keep, or no template open, does nothing.
   */
  snapshotOpenDraft: () => Promise<void>;
  /** Replaces the open draft, keeping unsaved edits in history first. */
  importIntoDraft: (doc: ResumeData, from: string) => Promise<void>;
  /**
   * Puts an older version back as the template's draft, keeping unsaved edits in history
   * first, and opens that template if another one is open.
   */
  restoreVersion: (templateId: string, versionId: string) => Promise<void>;

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
    /**
     * Put a draft from main in the editor. Staged AI changes and a version preview were
     * about the draft being replaced, so they go. `asStep` names a replacement of the same
     * template's draft as one undoable step — see `loadDraft`.
     */
    const showDraft = (draft: Draft | null, asStep?: string) => {
      set((state) => {
        state.pendingAiChanges = [];
      });
      useOverlayStore.getState().setPreview(null);
      useResumeStore.getState().loadDraft(draft, asStep ? { asStep } : undefined);
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
        // The new one takes the editor, so the draft it displaces is kept first.
        await get().snapshotOpenDraft();
        const db = getDb();
        const created = await db.templates.create(name, doc, importedFrom);
        showDraft(await db.templates.open(created.id));
        await get().refresh();
      },

      openTemplate: async (id) => {
        if (id === openTemplateId()) return;
        // Undo does not survive the switch, so what it could have taken back is kept.
        await get().snapshotOpenDraft();
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
        const copy = await getDb().templates.duplicate(id);
        await get().refresh();
        return copy;
      },

      duplicateVersion: async (versionId) => {
        const copy = await getDb().versions.duplicate(versionId);
        await get().refresh();
        return copy;
      },

      deleteTemplate: async (id) => {
        const wasOpen = id === openTemplateId();
        // The copy kept for Undo should have the latest edits.
        if (wasOpen) await flushDraft();
        const db = getDb();
        const bundle = await db.bundle.export([id]);
        await db.templates.remove(id);
        await get().refresh();
        if (wasOpen) {
          const next = get().templates.reduce<TemplateSummary | undefined>(
            (latest, t) => (latest && latest.updatedAt >= t.updatedAt ? latest : t),
            undefined
          );
          showDraft(next ? await db.templates.open(next.id) : null);
        }
        return { bundle, wasOpen };
      },

      restoreDeleted: async ({ bundle, wasOpen }) => {
        const [id] = await get().importBundle(JSON.stringify(bundle), 'as-new-template');
        if (wasOpen) await get().openTemplate(id);
      },

      importBundle: async (text, mode) => {
        await flushDraft();
        const db = getDb();
        const { templateIds } = await db.bundle.import(text, mode);
        const open = openTemplateId();
        if (open === null || mode === 'restore-all') {
          // A backup of this app brings the same ids back; keep the same template open.
          const id = open !== null && templateIds.includes(open) ? open : templateIds[0];
          showDraft(await db.templates.open(id));
        }
        await get().refresh();
        return templateIds;
      },

      nameVersion: async (name) => {
        const templateId = requireOpenTemplate();
        await flushDraft();
        const version = await getDb().versions.name(templateId, name);
        // The draft is that version now, so the status bar counts changes from here.
        useResumeStore.getState().markVersionSaved(version.rev);
        await get().refresh();
        return version;
      },

      snapshotOpenDraft: async () => {
        await flushDraft();
        const templateId = openTemplateId();
        if (templateId === null) return;
        try {
          const version = await getDb().versions.snapshot(templateId);
          // Still the same draft? An open that overtook this one has its own baseline.
          if (openTemplateId() === templateId) {
            useResumeStore.getState().markVersionSaved(version.rev);
          }
          await get().refresh();
        } catch (error) {
          // A snapshot is taken for the user, not asked for. Failing one must not stop
          // them switching template or closing the window.
          console.error('Could not keep a version of the draft', error);
        }
      },

      importIntoDraft: async (doc, from) => {
        const templateId = requireOpenTemplate();
        await flushDraft();
        showDraft(await getDb().drafts.importInto(templateId, doc, from), 'import');
        await get().refresh();
      },

      restoreVersion: async (templateId, versionId) => {
        await flushDraft();
        const db = getDb();
        const restored = await db.versions.restore(templateId, versionId);
        // Restoring into the open draft is a step of it; another template is a fresh start.
        if (templateId === openTemplateId()) showDraft(restored, 'restore');
        else showDraft(await db.templates.open(templateId));
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
