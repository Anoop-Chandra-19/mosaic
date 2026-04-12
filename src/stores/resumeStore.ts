import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { dexieStorage } from '@/lib/dexieStorage';
import type {
  ResumeData,
  ResumeSection,
  ResumeEntry,
  ContactInfo,
  SectionType,
} from '@/types/resume';

/* ── Helpers ─────────────────────────────────────────────── */

function mapSection(
  sections: ResumeSection[],
  sectionId: string,
  fn: (section: ResumeSection) => ResumeSection
): ResumeSection[] {
  return sections.map((s) => (s.id === sectionId ? fn(s) : s));
}

function mapEntry(
  items: ResumeEntry[],
  entryId: string,
  fn: (entry: ResumeEntry) => ResumeEntry
): ResumeEntry[] {
  return items.map((e) => (e.id === entryId ? fn(e) : e));
}

/* ── Seed Data ───────────────────────────────────────────── */

const DEFAULT_RESUME: ResumeData = {
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

/* ── Store Interface ─────────────────────────────────────── */

interface ResumeState extends ResumeData {
  updateContact: (patch: Partial<ContactInfo>) => void;
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

/* ── Store ───────────────────────────────────────────────── */

export const useResumeStore = create<ResumeState>()(
  persist(
    (set) => ({
      ...createDefaultResume(),

      // ── Contact ──

      updateContact: (patch) => set((state) => ({ contact: { ...state.contact, ...patch } })),
      resetResume: () => set(() => ({ ...createDefaultResume() })),

      // ── Section CRUD ──

      addSection: (type, label) =>
        set((state) => ({
          sections: [
            ...state.sections,
            {
              id: crypto.randomUUID(),
              type,
              label,
              items: [],
              order: state.sections.length,
            },
          ],
        })),

      removeSection: (sectionId) =>
        set((state) => ({
          sections: state.sections.filter((s) => s.id !== sectionId),
        })),

      reorderSections: (orderedIds) =>
        set((state) => {
          const byId = new Map(state.sections.map((s) => [s.id, s]));
          return {
            sections: orderedIds
              .map((id, i) => {
                const s = byId.get(id);
                return s ? { ...s, order: i } : null;
              })
              .filter((s): s is ResumeSection => s !== null),
          };
        }),

      updateSectionLabel: (sectionId, label) =>
        set((state) => ({
          sections: mapSection(state.sections, sectionId, (s) => ({ ...s, label })),
        })),

      // ── Entry CRUD ──

      addEntry: (sectionId, entry) =>
        set((state) => ({
          sections: mapSection(state.sections, sectionId, (s) => ({
            ...s,
            items: [...s.items, { ...entry, id: crypto.randomUUID() }],
          })),
        })),

      updateEntry: (sectionId, entryId, patch) =>
        set((state) => ({
          sections: mapSection(state.sections, sectionId, (s) => ({
            ...s,
            items: mapEntry(s.items, entryId, (e) => ({ ...e, ...patch })),
          })),
        })),

      removeEntry: (sectionId, entryId) =>
        set((state) => ({
          sections: mapSection(state.sections, sectionId, (s) => ({
            ...s,
            items: s.items.filter((e) => e.id !== entryId),
          })),
        })),

      toggleEntry: (sectionId, entryId) =>
        set((state) => ({
          sections: mapSection(state.sections, sectionId, (s) => ({
            ...s,
            items: mapEntry(s.items, entryId, (e) => {
              const next = !e.selected;
              return {
                ...e,
                selected: next,
                bullets: e.bullets.map((b) => ({ ...b, selected: next })),
              };
            }),
          })),
        })),

      reorderEntries: (sectionId, orderedIds) =>
        set((state) => ({
          sections: mapSection(state.sections, sectionId, (s) => {
            const byId = new Map(s.items.map((e) => [e.id, e]));
            return {
              ...s,
              items: orderedIds
                .map((id) => byId.get(id))
                .filter((e): e is ResumeEntry => e !== undefined),
            };
          }),
        })),

      // ── Bullet CRUD ──

      addBullet: (sectionId, entryId, text) =>
        set((state) => ({
          sections: mapSection(state.sections, sectionId, (s) => ({
            ...s,
            items: mapEntry(s.items, entryId, (e) => ({
              ...e,
              bullets: [...e.bullets, { id: crypto.randomUUID(), text, selected: true }],
            })),
          })),
        })),

      updateBullet: (sectionId, entryId, bulletId, text) =>
        set((state) => ({
          sections: mapSection(state.sections, sectionId, (s) => ({
            ...s,
            items: mapEntry(s.items, entryId, (e) => ({
              ...e,
              bullets: e.bullets.map((b) => (b.id === bulletId ? { ...b, text } : b)),
            })),
          })),
        })),

      removeBullet: (sectionId, entryId, bulletId) =>
        set((state) => ({
          sections: mapSection(state.sections, sectionId, (s) => ({
            ...s,
            items: mapEntry(s.items, entryId, (e) => ({
              ...e,
              bullets: e.bullets.filter((b) => b.id !== bulletId),
            })),
          })),
        })),

      toggleBullet: (sectionId, entryId, bulletId) =>
        set((state) => ({
          sections: mapSection(state.sections, sectionId, (s) => ({
            ...s,
            items: mapEntry(s.items, entryId, (e) => ({
              ...e,
              bullets: e.bullets.map((b) =>
                b.id === bulletId ? { ...b, selected: !b.selected } : b
              ),
            })),
          })),
        })),
    }),
    {
      name: 'mosaic-resume',
      storage: createJSONStorage(() => dexieStorage),
    }
  )
);
