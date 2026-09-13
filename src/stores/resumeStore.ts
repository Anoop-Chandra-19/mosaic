import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { getStorage } from '@/lib/storage';
import type { ResumeData, ResumeEntry, ContactInfo, SectionType } from '@/types/resume';
import { createDefaultResume } from '@/lib/resume/defaultResume';

/* Store Interface */

interface ResumeState extends ResumeData {
  updateContact: (patch: Partial<ContactInfo>) => void;
  replaceResume: (data: ResumeData) => void;
  resetResume: () => void;

  addSection: (type: SectionType, label: string) => void;
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
  persist(
    immer((set) => ({
      ...createDefaultResume(),

      // Contact

      updateContact: (patch) =>
        set((state) => {
          Object.assign(state.contact, patch);
        }),

      replaceResume: (data) =>
        set((state) => {
          state.schemaVersion = data.schemaVersion;
          state.contact = data.contact;
          state.sections = data.sections;
        }),

      resetResume: () =>
        set((state) => {
          const fresh = createDefaultResume();
          state.schemaVersion = fresh.schemaVersion;
          state.contact = fresh.contact;
          state.sections = fresh.sections;
        }),

      // Section CRUD

      addSection: (type, label) =>
        set((state) => {
          state.sections.push({
            id: crypto.randomUUID(),
            type,
            label,
            items: [],
            order: state.sections.length,
          });
        }),

      removeSection: (sectionId) =>
        set((state) => {
          state.sections = state.sections.filter((s) => s.id !== sectionId);
        }),

      reorderSections: (orderedIds) =>
        set((state) => {
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
        set((state) => {
          const section = state.sections.find((s) => s.id === sectionId);
          if (section) section.label = label;
        }),

      // Entry CRUD

      addEntry: (sectionId, entry) =>
        set((state) => {
          const section = state.sections.find((s) => s.id === sectionId);
          if (section) section.items.push({ ...entry, id: crypto.randomUUID() });
        }),

      updateEntry: (sectionId, entryId, patch) =>
        set((state) => {
          const section = state.sections.find((s) => s.id === sectionId);
          if (!section) return;
          const entry = section.items.find((e) => e.id === entryId);
          if (entry) Object.assign(entry, patch);
        }),

      removeEntry: (sectionId, entryId) =>
        set((state) => {
          const section = state.sections.find((s) => s.id === sectionId);
          if (section) section.items = section.items.filter((e) => e.id !== entryId);
        }),

      toggleEntry: (sectionId, entryId) =>
        set((state) => {
          const section = state.sections.find((s) => s.id === sectionId);
          if (!section) return;
          const entry = section.items.find((e) => e.id === entryId);
          if (!entry) return;
          const next = !entry.selected;
          entry.selected = next;
          for (const b of entry.bullets) b.selected = next;
        }),

      reorderEntries: (sectionId, orderedIds) =>
        set((state) => {
          const section = state.sections.find((s) => s.id === sectionId);
          if (!section) return;
          const byId = new Map(section.items.map((e) => [e.id, e]));
          section.items = orderedIds
            .map((id) => byId.get(id))
            .filter((e): e is (typeof section.items)[number] => e !== undefined);
        }),

      // Bullet CRUD

      addBullet: (sectionId, entryId, text) =>
        set((state) => {
          const section = state.sections.find((s) => s.id === sectionId);
          if (!section) return;
          const entry = section.items.find((e) => e.id === entryId);
          if (entry) entry.bullets.push({ id: crypto.randomUUID(), text, selected: true });
        }),

      updateBullet: (sectionId, entryId, bulletId, text) =>
        set((state) => {
          const section = state.sections.find((s) => s.id === sectionId);
          if (!section) return;
          const entry = section.items.find((e) => e.id === entryId);
          if (!entry) return;
          const bullet = entry.bullets.find((b) => b.id === bulletId);
          if (bullet) bullet.text = text;
        }),

      removeBullet: (sectionId, entryId, bulletId) =>
        set((state) => {
          const section = state.sections.find((s) => s.id === sectionId);
          if (!section) return;
          const entry = section.items.find((e) => e.id === entryId);
          if (entry) entry.bullets = entry.bullets.filter((b) => b.id !== bulletId);
        }),

      toggleBullet: (sectionId, entryId, bulletId) =>
        set((state) => {
          const section = state.sections.find((s) => s.id === sectionId);
          if (!section) return;
          const entry = section.items.find((e) => e.id === entryId);
          if (!entry) return;
          const bullet = entry.bullets.find((b) => b.id === bulletId);
          if (bullet) bullet.selected = !bullet.selected;
        }),
    })),
    {
      name: 'mosaic-resume',
      version: 1,
      storage: createJSONStorage(() => getStorage()),
      migrate: (persisted: unknown, version: number) => {
        const state = persisted as ResumeData;
        if (version < 1) {
          return { ...state, schemaVersion: 1 };
        }
        return state;
      },
    }
  )
);

export function getResumeSnapshot(): ResumeData {
  const { schemaVersion, contact, sections } = useResumeStore.getState();
  return structuredClone({ schemaVersion, contact, sections });
}
