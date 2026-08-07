import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { getStorage } from '@/lib/storage';
import type { ResumeData, ResumeEntry, ContactInfo, SectionType } from '@/types/resume';

/* Seed Data */

const DEFAULT_RESUME: ResumeData = {
  schemaVersion: 1,
  contact: {
    name: 'Your Name',
    email: 'you@example.com',
    phone: '(555) 010-0100',
    location: 'City, State',
    citizenshipStatus: 'US Citizen',
    linkedin: 'LinkedIn',
    github: '',
    website: '',
    showLinkedin: true,
    showGithub: false,
    showWebsite: false,
  },
  // Sections follow the Headless format: Education above Work History, no
  // Summary or Skills block. Bullets show the shape the format asks for --
  // a keyword, how it was used, then the result or reason.
  sections: [
    {
      id: 'sec-education',
      type: 'education',
      label: 'Education & Certificates',
      order: 0,
      items: [
        {
          id: 'edu1',
          selected: true,
          title: 'M.S. in Your Field from Your University in City, State',
          subtitle: '2025',
          bullets: [],
        },
        {
          id: 'edu2',
          selected: true,
          title: 'B.S. in Your Field from Your University in City, State',
          subtitle: 'Status - Graduated',
          bullets: [],
        },
      ],
    },
    {
      id: 'sec-experience',
      type: 'experience',
      label: 'Work History',
      order: 1,
      items: [
        {
          id: 'job1',
          selected: true,
          title: 'Job Title at Company, Location',
          subtitle: 'Month Year to Current',
          bullets: [
            {
              id: 'j1b1',
              selected: true,
              text: 'Worked in Agile sprints building and supporting the website, phone app, and AI features at a company that serves more than 10,000 customers.',
            },
            {
              id: 'j1b2',
              selected: true,
              text: 'Wrote the main product screens in TypeScript, JavaScript, HTML, CSS, and React, so customers could finish a task on screen instead of filing paperwork.',
            },
            {
              id: 'j1b3',
              selected: true,
              text: 'Built REST APIs in Node.js and NestJS over a PostgreSQL database, letting people save an unfinished form and come back to it later.',
            },
            {
              id: 'j1b4',
              selected: true,
              text: 'Wrote an AI agent in Python on a cloud platform with an agentic orchestrator over a hosted model, so a customer gets advice tailored to their own numbers.',
            },
            {
              id: 'j1b5',
              selected: true,
              text: 'Tested three machine learning methods for sorting customer conversations into topics, scored each one with SQL, and showed a cross functional group of leads which one to build on.',
            },
            {
              id: 'j1b6',
              selected: true,
              text: 'Handled DevOps deployments to QA and production using Docker images, Helm charts, and Git based CI/CD pipelines on Kubernetes, so every release went out the same way.',
            },
          ],
        },
      ],
    },
    {
      id: 'sec-projects',
      type: 'projects',
      label: 'Projects',
      order: 2,
      items: [
        {
          id: 'proj1',
          selected: true,
          title: 'First Project',
          subtitle: '',
          bullets: [
            {
              id: 'p1b1',
              selected: true,
              text: 'Say in one plain sentence what the project does and who it is for.',
            },
            {
              id: 'p1b2',
              selected: true,
              text: 'Trained a machine learning model in PyTorch using NumPy and pandas to sort inputs into categories at about 77 percent accuracy, so a user gets an answer instead of sorting by hand.',
            },
            {
              id: 'p1b3',
              selected: true,
              text: 'Served the trained model from a Docker container on AWS behind a small web page, so anyone could try it in a browser instead of installing anything.',
            },
          ],
        },
        {
          id: 'proj2',
          selected: true,
          title: 'Second Project',
          subtitle: '',
          bullets: [
            {
              id: 'p2b1',
              selected: true,
              text: 'Built a tool that lets a person write, lay out, and print a document of their own.',
            },
            {
              id: 'p2b2',
              selected: true,
              text: 'Wrote it in TypeScript so everything stays inside the browser, meaning the data never leaves the browser it was written in.',
            },
            {
              id: 'p2b3',
              selected: true,
              text: 'Published it on GitHub with export to PDF and plain text, so a finished document can be sent anywhere.',
            },
          ],
        },
      ],
    },
  ],
};

function createDefaultResume(): ResumeData {
  return structuredClone(DEFAULT_RESUME);
}

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
