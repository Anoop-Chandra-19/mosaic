import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { DbError, getDb } from '@/lib/storage/mosaicDb';
import { createEmptyResume } from '@/lib/resume/defaultResume';
import type { Draft } from '@/types/db';
import type { ResumeData, ResumeEntry, ContactInfo, SectionType } from '@/types/resume';

/*
 * The draft in the editor: one template's document. Every edit bumps `rev` and schedules a
 * save; main stores the draft and the rev together. Documents from outside the editor
 * (opening a template, an import, a restore) arrive through `loadDraft` and are not saved
 * back — main just wrote them.
 */

/** A save goes out once typing pauses this long… */
const SAVE_DELAY_MS = 1000;
/** …or after this long of non-stop edits, so a crash loses seconds, not a session. */
const SAVE_MAX_WAIT_MS = 5000;

interface ResumeState extends ResumeData {
  /** The template whose draft this is; null while no template is open. */
  templateId: string | null;
  /** Bumped by every edit — the counter the agent's anchors check. */
  rev: number;
  /** The last save failed for a reason other than being superseded. */
  saveFailed: boolean;
  /**
   * When this session last saved the draft; null until it has. Before that, the template's
   * `updatedAt` says when main last wrote it.
   */
  savedAt: number | null;

  loadDraft: (draft: Draft | null) => void;

  updateContact: (patch: Partial<ContactInfo>) => void;

  /** Adds an empty section at the end; returns its id. */
  addSection: (type: SectionType, label: string) => string;
  removeSection: (sectionId: string) => void;
  reorderSections: (orderedIds: string[]) => void;
  updateSectionLabel: (sectionId: string, label: string) => void;

  addEntry: (sectionId: string, entry: Omit<ResumeEntry, 'id'>) => void;
  updateEntry: (
    sectionId: string,
    entryId: string,
    patch: Partial<Omit<ResumeEntry, 'id' | 'bullets'>>
  ) => void;
  removeEntry: (sectionId: string, entryId: string) => void;
  toggleEntry: (sectionId: string, entryId: string) => void;
  reorderEntries: (sectionId: string, orderedIds: string[]) => void;

  addBullet: (sectionId: string, entryId: string, text: string) => void;
  updateBullet: (sectionId: string, entryId: string, bulletId: string, text: string) => void;
  removeBullet: (sectionId: string, entryId: string, bulletId: string) => void;
  toggleBullet: (sectionId: string, entryId: string, bulletId: string) => void;
}

/* Store */

export const useResumeStore = create<ResumeState>()(
  immer((set) => {
    /** An edit: change the document, bump the rev, and queue a save. */
    const edit = (recipe: (state: ResumeState) => void) => {
      set((state) => {
        recipe(state);
        state.rev += 1;
      });
      scheduleSave();
    };

    return {
      ...createEmptyResume(),
      templateId: null,
      rev: 0,
      saveFailed: false,
      savedAt: null,

      loadDraft: (draft) => {
        cancelPendingSave();
        const doc = draft?.doc ?? createEmptyResume();
        set((state) => {
          state.schemaVersion = doc.schemaVersion;
          state.contact = doc.contact;
          state.sections = doc.sections;
          state.templateId = draft?.templateId ?? null;
          state.rev = draft?.rev ?? 0;
          state.saveFailed = false;
          state.savedAt = null;
        });
      },

      // Contact

      updateContact: (patch) =>
        edit((state) => {
          Object.assign(state.contact, patch);
        }),

      // Section CRUD

      addSection: (type, label) => {
        const id = crypto.randomUUID();
        edit((state) => {
          state.sections.push({ id, type, label, items: [], order: state.sections.length });
        });
        return id;
      },

      removeSection: (sectionId) =>
        edit((state) => {
          state.sections = state.sections.filter((s) => s.id !== sectionId);
        }),

      reorderSections: (orderedIds) =>
        edit((state) => {
          const byId = new Map(state.sections.map((s) => [s.id, s]));
          state.sections = orderedIds
            .map((id, i) => {
              const s = byId.get(id);
              if (s) s.order = i;
              return s;
            })
            .filter((s): s is (typeof state.sections)[number] => s != null);
        }),

      updateSectionLabel: (sectionId, label) =>
        edit((state) => {
          const section = state.sections.find((s) => s.id === sectionId);
          if (section) section.label = label;
        }),

      // Entry CRUD

      addEntry: (sectionId, entry) =>
        edit((state) => {
          const section = state.sections.find((s) => s.id === sectionId);
          if (section) section.items.push({ ...entry, id: crypto.randomUUID() });
        }),

      updateEntry: (sectionId, entryId, patch) =>
        edit((state) => {
          const section = state.sections.find((s) => s.id === sectionId);
          if (!section) return;
          const entry = section.items.find((e) => e.id === entryId);
          if (entry) Object.assign(entry, patch);
        }),

      removeEntry: (sectionId, entryId) =>
        edit((state) => {
          const section = state.sections.find((s) => s.id === sectionId);
          if (section) section.items = section.items.filter((e) => e.id !== entryId);
        }),

      toggleEntry: (sectionId, entryId) =>
        edit((state) => {
          const section = state.sections.find((s) => s.id === sectionId);
          if (!section) return;
          const entry = section.items.find((e) => e.id === entryId);
          if (!entry) return;
          const next = !entry.selected;
          entry.selected = next;
          for (const b of entry.bullets) b.selected = next;
        }),

      reorderEntries: (sectionId, orderedIds) =>
        edit((state) => {
          const section = state.sections.find((s) => s.id === sectionId);
          if (!section) return;
          const byId = new Map(section.items.map((e) => [e.id, e]));
          section.items = orderedIds
            .map((id) => byId.get(id))
            .filter((e): e is (typeof section.items)[number] => e !== undefined);
        }),

      // Bullet CRUD

      addBullet: (sectionId, entryId, text) =>
        edit((state) => {
          const section = state.sections.find((s) => s.id === sectionId);
          if (!section) return;
          const entry = section.items.find((e) => e.id === entryId);
          if (entry) entry.bullets.push({ id: crypto.randomUUID(), text, selected: true });
        }),

      updateBullet: (sectionId, entryId, bulletId, text) =>
        edit((state) => {
          const section = state.sections.find((s) => s.id === sectionId);
          if (!section) return;
          const entry = section.items.find((e) => e.id === entryId);
          if (!entry) return;
          const bullet = entry.bullets.find((b) => b.id === bulletId);
          if (bullet) bullet.text = text;
        }),

      removeBullet: (sectionId, entryId, bulletId) =>
        edit((state) => {
          const section = state.sections.find((s) => s.id === sectionId);
          if (!section) return;
          const entry = section.items.find((e) => e.id === entryId);
          if (entry) entry.bullets = entry.bullets.filter((b) => b.id !== bulletId);
        }),

      toggleBullet: (sectionId, entryId, bulletId) =>
        edit((state) => {
          const section = state.sections.find((s) => s.id === sectionId);
          if (!section) return;
          const entry = section.items.find((e) => e.id === entryId);
          if (!entry) return;
          const bullet = entry.bullets.find((b) => b.id === bulletId);
          if (bullet) bullet.selected = !bullet.selected;
        }),
    };
  })
);

export function getResumeSnapshot(): ResumeData {
  const { schemaVersion, contact, sections } = useResumeStore.getState();
  return structuredClone({ schemaVersion, contact, sections });
}

/* Saving */

let timer: ReturnType<typeof setTimeout> | undefined;
/** When the oldest unsaved edit was made; null when nothing is waiting. */
let pendingSince: number | null = null;
/** Saves run one after another, so `flushDraft` can wait for all of them. */
let saving: Promise<void> = Promise.resolve();

function scheduleSave() {
  const now = Date.now();
  pendingSince ??= now;
  clearTimeout(timer);
  const wait = Math.min(SAVE_DELAY_MS, pendingSince + SAVE_MAX_WAIT_MS - now);
  timer = setTimeout(() => void flushDraft(), Math.max(0, wait));
}

function cancelPendingSave() {
  clearTimeout(timer);
  timer = undefined;
  pendingSince = null;
}

async function save(templateId: string, doc: ResumeData, rev: number) {
  try {
    await getDb().drafts.save(templateId, doc, rev);
    useResumeStore.setState({ saveFailed: false, savedAt: Date.now() });
  } catch (error) {
    // A newer draft already came from main (an import or restore landed after this edit
    // was queued), or the template was deleted: either way this save has nothing to keep.
    if (error instanceof DbError && (error.code === 'stale-rev' || error.code === 'not-found')) {
      return;
    }
    console.error('Could not save the draft', error);
    useResumeStore.setState({ saveFailed: true });
  }
}

/**
 * Save now whatever is waiting, and resolve once every save so far has landed. Called
 * before anything that reads the draft from main (switching or duplicating a template,
 * an import) and when the window closes.
 */
export function flushDraft(): Promise<void> {
  if (pendingSince !== null) {
    cancelPendingSave();
    const { templateId, rev } = useResumeStore.getState();
    if (templateId !== null) {
      const doc = getResumeSnapshot();
      saving = saving.then(() => save(templateId, doc, rev));
    }
  }
  return saving;
}
