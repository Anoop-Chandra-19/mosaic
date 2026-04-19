import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { dexieStorage } from '@/lib/dexieStorage';
import { migrateResume } from '@/lib/resume/migrateResume';
import { getResumeSnapshot, useResumeStore } from '@/stores/resumeStore';
import type {
  ResumeData,
  TemplateRecord,
  TemplateVersion,
  TemplateVersionSource,
  PendingTextAiChange,
  RollbackReason,
  LocalCheckpoint,
} from '@/types/resume';

/* Helpers */

function now() {
  return new Date().toISOString();
}

function createVersion(
  templateId: string,
  parentVersionId: string | null,
  snapshot: ResumeData,
  source: TemplateVersionSource,
  message: string
): TemplateVersion {
  return {
    id: crypto.randomUUID(),
    templateId,
    parentVersionId,
    createdAt: now(),
    message,
    source,
    snapshot: migrateResume(structuredClone(snapshot)),
  };
}

/* Store Interface */

interface TemplateState {
  templates: TemplateRecord[];
  versionsByTemplateId: Record<string, TemplateVersion[]>;
  activeTemplateId: string | null;
  activeVersionId: string | null;
  pendingAiChanges: PendingTextAiChange[];
  rollbackSnapshots: Partial<Record<RollbackReason, LocalCheckpoint>>;

  // Template CRUD
  saveNewTemplate: (name: string, snapshot: ResumeData, message?: string) => void;
  updateActiveTemplate: (snapshot: ResumeData, message?: string) => void;
  applyTemplate: (templateId: string, versionId?: string) => void;
  renameTemplate: (templateId: string, name: string) => void;
  duplicateTemplate: (templateId: string) => void;
  deleteTemplate: (templateId: string) => void;

  // Version actions (T2, exposed now for interface stability)
  restoreTemplateVersion: (templateId: string, versionId: string) => void;

  // Rollback snapshot actions
  captureRollback: (reason: RollbackReason, snapshot: ResumeData) => void;
  consumeRollback: (reason: RollbackReason) => void;
  dismissRollback: (reason: RollbackReason) => void;
  clearAllRollbacks: () => void;

  // AI queue actions (T3, exposed now for interface stability)
  enqueueAiChange: (change: PendingTextAiChange) => void;
  keepAiChange: (changeId: string) => void;
  undoAiChange: (changeId: string) => void;
  keepAllAiChanges: () => void;
  undoAllAiChanges: () => void;
  clearAiChanges: () => void;

  // Reset
  resetTemplates: () => void;

  // Derived helpers
  getHeadSnapshot: (templateId: string) => ResumeData | null;
  clearActiveTemplate: () => void;
}

/* Store */

export const useTemplateStore = create<TemplateState>()(
  persist(
    immer((set, get) => ({
      templates: [],
      versionsByTemplateId: {},
      activeTemplateId: null,
      activeVersionId: null,
      pendingAiChanges: [],
      rollbackSnapshots: {},

      // Template CRUD

      saveNewTemplate: (name, snapshot, message = 'Initial save') => {
        const templateId = crypto.randomUUID();
        const version = createVersion(templateId, null, snapshot, 'save-new', message);

        set((state) => {
          state.templates.push({
            id: templateId,
            name,
            createdAt: version.createdAt,
            updatedAt: version.createdAt,
            headVersionId: version.id,
          });
          state.versionsByTemplateId[templateId] = [version];
          state.activeTemplateId = templateId;
          state.activeVersionId = version.id;
        });
      },

      updateActiveTemplate: (snapshot, message = 'Update from editor') => {
        const { activeTemplateId, activeVersionId } = get();
        if (!activeTemplateId) return;

        const version = createVersion(
          activeTemplateId,
          activeVersionId,
          snapshot,
          'update',
          message
        );

        set((state) => {
          const tmpl = state.templates.find((t) => t.id === activeTemplateId);
          if (!tmpl) return;
          tmpl.headVersionId = version.id;
          tmpl.updatedAt = version.createdAt;

          const versions = state.versionsByTemplateId[activeTemplateId];
          if (versions) {
            versions.push(version);
          } else {
            state.versionsByTemplateId[activeTemplateId] = [version];
          }

          state.activeVersionId = version.id;
        });
      },

      applyTemplate: (templateId, versionId?) => {
        const state = get();
        const tmpl = state.templates.find((t) => t.id === templateId);
        if (!tmpl) return;

        const versions = state.versionsByTemplateId[templateId];
        if (!versions?.length) return;

        const targetVersionId = versionId ?? tmpl.headVersionId;
        const version = versions.find((v) => v.id === targetVersionId);
        if (!version) return;

        const snapshot = migrateResume(structuredClone(version.snapshot));
        useResumeStore.getState().replaceResume(snapshot);

        set((s) => {
          s.activeTemplateId = templateId;
          s.activeVersionId = targetVersionId;
        });
      },

      renameTemplate: (templateId, name) =>
        set((state) => {
          const tmpl = state.templates.find((t) => t.id === templateId);
          if (tmpl) {
            tmpl.name = name;
            tmpl.updatedAt = now();
          }
        }),

      duplicateTemplate: (templateId) => {
        const state = get();
        const tmpl = state.templates.find((t) => t.id === templateId);
        if (!tmpl) return;

        const versions = state.versionsByTemplateId[templateId];
        const headVersion = versions?.find((v) => v.id === tmpl.headVersionId);
        if (!headVersion) return;

        const newId = crypto.randomUUID();
        const version = createVersion(
          newId,
          null,
          headVersion.snapshot,
          'save-new',
          `Duplicated from "${tmpl.name}"`
        );

        set((s) => {
          s.templates.push({
            id: newId,
            name: `${tmpl.name} (copy)`,
            createdAt: version.createdAt,
            updatedAt: version.createdAt,
            headVersionId: version.id,
          });
          s.versionsByTemplateId[newId] = [version];
        });
      },

      deleteTemplate: (templateId) =>
        set((state) => {
          state.templates = state.templates.filter((t) => t.id !== templateId);
          delete state.versionsByTemplateId[templateId];
          if (state.activeTemplateId === templateId) {
            state.activeTemplateId = null;
            state.activeVersionId = null;
          }
        }),

      // Version restore (T2 core, wired now)

      restoreTemplateVersion: (templateId, versionId) => {
        const state = get();
        const versions = state.versionsByTemplateId[templateId];
        const version = versions?.find((v) => v.id === versionId);
        if (!version) return;

        // Capture rollback before restoring
        const currentSnapshot = getResumeSnapshot();
        get().captureRollback('before-restore', currentSnapshot);

        const restoredVersion = createVersion(
          templateId,
          versionId,
          version.snapshot,
          'restore',
          `Restored from ${new Date(version.createdAt).toLocaleDateString()}`
        );

        const snapshot = migrateResume(structuredClone(version.snapshot));
        useResumeStore.getState().replaceResume(snapshot);

        set((s) => {
          const tmpl = s.templates.find((t) => t.id === templateId);
          if (!tmpl) return;
          tmpl.headVersionId = restoredVersion.id;
          tmpl.updatedAt = restoredVersion.createdAt;

          const vers = s.versionsByTemplateId[templateId];
          if (vers) {
            vers.push(restoredVersion);
          } else {
            s.versionsByTemplateId[templateId] = [restoredVersion];
          }

          s.activeTemplateId = templateId;
          s.activeVersionId = restoredVersion.id;
        });
      },

      // Rollback snapshots

      captureRollback: (reason, snapshot) =>
        set((state) => {
          state.rollbackSnapshots[reason] = {
            createdAt: now(),
            reason,
            snapshot: structuredClone(snapshot),
          };
        }),

      consumeRollback: (reason) => {
        const checkpoint = get().rollbackSnapshots[reason];
        if (!checkpoint) return;

        const snapshot = migrateResume(structuredClone(checkpoint.snapshot));
        useResumeStore.getState().replaceResume(snapshot);

        set((state) => {
          delete state.rollbackSnapshots[reason];
        });
      },

      dismissRollback: (reason) =>
        set((state) => {
          delete state.rollbackSnapshots[reason];
        }),

      clearAllRollbacks: () =>
        set((state) => {
          state.rollbackSnapshots = {};
        }),

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
        const state = get();
        const change = state.pendingAiChanges.find((c) => c.id === changeId);
        if (!change) return;

        // Revert the text in resumeStore
        const { target, before } = change;
        const resume = useResumeStore.getState();
        if (target.kind === 'bullet-text') {
          resume.updateBullet(target.sectionId, target.entryId, target.bulletId, before);
        } else {
          resume.updateEntry(target.sectionId, target.entryId, { text: before });
        }

        set((s) => {
          s.pendingAiChanges = s.pendingAiChanges.filter((c) => c.id !== changeId);
        });
      },

      keepAllAiChanges: () =>
        set((state) => {
          state.pendingAiChanges = [];
        }),

      undoAllAiChanges: () => {
        const changes = [...get().pendingAiChanges].reverse();
        const resume = useResumeStore.getState();

        for (const change of changes) {
          const { target, before } = change;
          if (target.kind === 'bullet-text') {
            resume.updateBullet(target.sectionId, target.entryId, target.bulletId, before);
          } else {
            resume.updateEntry(target.sectionId, target.entryId, { text: before });
          }
        }

        set((state) => {
          state.pendingAiChanges = [];
        });
      },

      clearAiChanges: () =>
        set((state) => {
          state.pendingAiChanges = [];
        }),

      // Reset

      resetTemplates: () =>
        set((state) => {
          state.templates = [];
          state.versionsByTemplateId = {};
          state.activeTemplateId = null;
          state.activeVersionId = null;
          state.pendingAiChanges = [];
          state.rollbackSnapshots = {};
        }),

      // Derived helpers

      getHeadSnapshot: (templateId) => {
        const state = get();
        const tmpl = state.templates.find((t) => t.id === templateId);
        if (!tmpl) return null;
        const versions = state.versionsByTemplateId[templateId];
        const head = versions?.find((v) => v.id === tmpl.headVersionId);
        return head ? migrateResume(structuredClone(head.snapshot)) : null;
      },

      clearActiveTemplate: () =>
        set((state) => {
          state.activeTemplateId = null;
          state.activeVersionId = null;
        }),
    })),
    {
      name: 'mosaic-templates',
      storage: createJSONStorage(() => dexieStorage),
      partialize: (state) => ({
        templates: state.templates,
        versionsByTemplateId: state.versionsByTemplateId,
        activeTemplateId: state.activeTemplateId,
        activeVersionId: state.activeVersionId,
        // pendingAiChanges and rollbackSnapshots are intentionally excluded.
        // They are ephemeral and should not survive page reloads.
      }),
    }
  )
);
