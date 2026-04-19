import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { dexieStorage } from '@/lib/dexieStorage';
import type { ResumeData, ResumeEntry, ContactInfo, SectionType } from '@/types/resume';

/* Seed Data */

const DEFAULT_RESUME: ResumeData = {
  schemaVersion: 1,
  contact: {
    name: 'Alex Johnson',
    email: 'alex.johnson@email.com',
    phone: '(555) 123-4567',
    location: 'San Francisco, CA',
    linkedin: 'linkedin.com/in/alexj',
    github: 'github.com/alexj',
    website: '',
    showLinkedin: true,
    showGithub: true,
    showWebsite: true,
  },
  sections: [
    {
      id: 'sec-summary',
      type: 'summary',
      label: 'Professional Summary',
      order: 0,
      items: [
        {
          id: 's1',
          selected: true,
          text: 'Results-driven software engineer with 3+ years of experience building scalable web applications. Proficient in TypeScript, React, and cloud-native architectures. Passionate about developer tooling and open-source contribution.',
          bullets: [],
        },
      ],
    },
    {
      id: 'sec-education',
      type: 'education',
      label: 'Education',
      order: 1,
      items: [
        {
          id: 'e1',
          selected: true,
          title: 'B.S. Computer Science',
          subtitle: 'University of Michigan — May 2023',
          bullets: [
            { id: 'e1b1', text: "GPA: 3.8/4.0, Dean's List all semesters", selected: true },
            {
              id: 'e1b2',
              text: 'Relevant coursework: Distributed Systems, Machine Learning, Database Systems',
              selected: true,
            },
            {
              id: 'e1b3',
              text: 'Teaching Assistant for EECS 281 (Data Structures & Algorithms)',
              selected: false,
            },
          ],
        },
      ],
    },
    {
      id: 'sec-experience',
      type: 'experience',
      label: 'Work Experience',
      order: 2,
      items: [
        {
          id: 'w1',
          selected: true,
          title: 'Software Engineer',
          subtitle: 'Acme Corp — Jun 2023 – Present',
          bullets: [
            {
              id: 'w1b1',
              text: 'Designed and implemented a real-time data pipeline processing 2M+ events/day using Kafka and Go',
              selected: true,
            },
            {
              id: 'w1b2',
              text: 'Led migration of legacy monolith to microservices, reducing deployment time by 60%',
              selected: true,
            },
            {
              id: 'w1b3',
              text: 'Mentored 2 junior engineers through code reviews and pair programming sessions',
              selected: true,
            },
            {
              id: 'w1b4',
              text: 'Built internal CLI tool that automated environment setup, saving 4 hours/week per developer',
              selected: false,
            },
          ],
        },
        {
          id: 'w2',
          selected: true,
          title: 'Software Engineering Intern',
          subtitle: 'StartupXYZ — Summer 2022',
          bullets: [
            {
              id: 'w2b1',
              text: 'Built a React dashboard for monitoring ML model performance metrics',
              selected: true,
            },
            {
              id: 'w2b2',
              text: 'Optimized PostgreSQL queries reducing p95 latency from 800ms to 120ms',
              selected: true,
            },
          ],
        },
      ],
    },
    {
      id: 'sec-projects',
      type: 'projects',
      label: 'Projects',
      order: 3,
      items: [
        {
          id: 'p1',
          selected: true,
          title: 'DevFlow',
          subtitle: 'Open Source — github.com/alexj/devflow',
          bullets: [
            {
              id: 'p1b1',
              text: 'Built a CLI tool for automating Git workflows with 500+ GitHub stars',
              selected: true,
            },
            {
              id: 'p1b2',
              text: 'Implemented plugin architecture supporting community-contributed extensions',
              selected: true,
            },
          ],
        },
        {
          id: 'p2',
          selected: false,
          title: 'CloudBudget',
          subtitle: 'Personal Project',
          bullets: [
            {
              id: 'p2b1',
              text: 'Full-stack expense tracker using Next.js, Prisma, and Stripe integration',
              selected: false,
            },
            {
              id: 'p2b2',
              text: 'Implemented OAuth 2.0 authentication with Google and GitHub providers',
              selected: false,
            },
          ],
        },
      ],
    },
    {
      id: 'sec-skills',
      type: 'skills',
      label: 'Skills',
      order: 4,
      items: [
        { id: 'sk1', selected: true, text: 'Languages: Python, TypeScript, Go, SQL', bullets: [] },
        {
          id: 'sk2',
          selected: true,
          text: 'Frameworks: React, Next.js, FastAPI, Express',
          bullets: [],
        },
        {
          id: 'sk3',
          selected: true,
          text: 'Tools: Docker, Kubernetes, Terraform, GitHub Actions',
          bullets: [],
        },
        { id: 'sk4', selected: true, text: 'Databases: PostgreSQL, Redis, MongoDB', bullets: [] },
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
      storage: createJSONStorage(() => dexieStorage),
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
