import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { getDb } from '@/lib/storage/mosaicDb';
import { useOverlayStore } from '@/stores/overlayStore';
import { flushDraft, saveDraftOrStop, useResumeStore } from '@/stores/resumeStore';
import { useUiStore } from '@/stores/uiStore';
import type { ImportMode, MosaicBundle } from '@shared/types/bundle';
import type { Draft, SnapshotOccasion, TemplateSummary, VersionMeta } from '@shared/types/db';
import type { ResumeData } from '@shared/types/resume';
import { formatBundleText } from '@shared/vault/formatBundle';

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
  /**
   * Counts renames and deletes in any history, which the summaries can miss (an older
   * version renamed), so a loaded history knows to read itself again.
   */
  historyEdits: number;

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
  snapshotOpenDraft: (occasion: SnapshotOccasion) => Promise<void>;
  /** Replaces the open draft, keeping unsaved edits in history first if the user wants it. */
  importIntoDraft: (doc: ResumeData, from: string) => Promise<void>;
  /**
   * Puts an older version back as the template's draft, keeping unsaved edits in history
   * first if the user wants it, and opens that template if another one is open.
   */
  restoreVersion: (templateId: string, versionId: string) => Promise<void>;
  /** Names any version of any template; see `MosaicDb['versions']['rename']`. */
  renameVersion: (versionId: string, name: string) => Promise<void>;
  /** Deletes a version other than the newest. `putBackVersion` undoes it. */
  removeVersion: (version: VersionMeta) => Promise<void>;
  putBackVersion: (versionId: string) => Promise<void>;
}

function openTemplateId(): string | null {
  return useResumeStore.getState().templateId;
}

function requireOpenTemplate(): string {
  const id = openTemplateId();
  if (id === null) throw new Error('No template is open');
  return id;
}

export const useTemplateStore = create<TemplateState>()(
  immer((set, get) => {
    /**
     * Put a draft from main in the editor. A version preview was about the draft being
     * replaced, so it goes. `asStep` names a replacement of the same template's draft as
     * one undoable step — see `loadDraft`.
     */
    const showDraft = (draft: Draft | null, asStep?: string) => {
      useOverlayStore.getState().setPreview(null);
      useResumeStore.getState().loadDraft(draft, asStep ? { asStep } : undefined);
    };

    /** After a rename or delete: summaries, and any history that is loaded, read again. */
    const refreshHistory = async () => {
      set((state) => {
        state.historyEdits += 1;
      });
      await get().refresh();
    };

    return {
      templates: [],
      historyEdits: 0,

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
        await saveDraftOrStop();
        await get().snapshotOpenDraft('switched');
        const db = getDb();
        const created = await db.templates.create(name, doc, importedFrom);
        showDraft(await db.templates.open(created.id));
        await get().refresh();
      },

      openTemplate: async (id) => {
        if (id === openTemplateId()) return;
        // Undo does not survive the switch, so what it could have taken back is kept.
        await saveDraftOrStop();
        await get().snapshotOpenDraft('switched');
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
        await saveDraftOrStop();
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
        if (wasOpen) await saveDraftOrStop();
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
        const [id] = await get().importBundle(formatBundleText(bundle), 'as-new-template');
        if (wasOpen) await get().openTemplate(id);
      },

      importBundle: async (text, mode) => {
        await saveDraftOrStop();
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
        await saveDraftOrStop();
        const version = await getDb().versions.name(templateId, name);
        // The draft is that version now, so the status bar counts changes from here.
        useResumeStore.getState().markVersionSaved(version.rev);
        await get().refresh();
        return version;
      },

      snapshotOpenDraft: async (occasion) => {
        if (!useUiStore.getState().snapshotTriggers.whileWorking) return;
        await flushDraft();
        const templateId = openTemplateId();
        if (templateId === null) return;
        try {
          const version = await getDb().versions.snapshot(templateId, occasion);
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
        await saveDraftOrStop();
        const { onImport } = useUiStore.getState().snapshotTriggers;
        showDraft(await getDb().drafts.importInto(templateId, doc, from, onImport), 'import');
        await get().refresh();
      },

      restoreVersion: async (templateId, versionId) => {
        await saveDraftOrStop();
        const db = getDb();
        const { beforeRestore } = useUiStore.getState().snapshotTriggers;
        const restored = await db.versions.restore(templateId, versionId, beforeRestore);
        // Restoring into the open draft is a step of it; another template is a fresh start.
        if (templateId === openTemplateId()) showDraft(restored, 'restore');
        else showDraft(await db.templates.open(templateId));
        await get().refresh();
      },

      renameVersion: async (versionId, name) => {
        await getDb().versions.rename(versionId, name);
        await refreshHistory();
      },

      removeVersion: async (version) => {
        await getDb().versions.remove(version.id);
        if (useOverlayStore.getState().preview?.version.id === version.id) {
          useOverlayStore.getState().setPreview(null);
        }
        await refreshHistory();
      },

      putBackVersion: async (versionId) => {
        await getDb().versions.putBack(versionId);
        await refreshHistory();
      },
    };
  })
);
