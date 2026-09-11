import { beforeEach, describe, expect, it, vi } from 'vitest';

// The stores persist through getStorage() → Dexie/IndexedDB, which is absent in the
// node test environment. Swap it for an in-memory adapter so store mutations are testable.
vi.mock('@/lib/storage', () => {
  const mem = new Map<string, string>();
  return {
    getStorage: () => ({
      getItem: async (key: string) => mem.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        mem.set(key, value);
      },
      removeItem: async (key: string) => {
        mem.delete(key);
      },
    }),
  };
});

import { useResumeStore } from '@/stores/resumeStore';
import type { ContactInfo, ResumeData, ResumeSection } from '@/types/resume';
import { applyImportedResume, describeImport } from '../applyImportedResume';
import type { ParsedResume } from '../parseResumeText';

function contact(overrides: Partial<ContactInfo> = {}): ContactInfo {
  return {
    name: '',
    email: '',
    phone: '',
    location: '',
    linkedin: '',
    github: '',
    website: '',
    showLinkedin: true,
    showGithub: true,
    showWebsite: true,
    ...overrides,
  };
}

function section(type: ResumeSection['type'], label: string, titles: string[]): ResumeSection {
  return {
    id: crypto.randomUUID(),
    type,
    label,
    order: 0,
    items: titles.map((title) => ({ id: crypto.randomUUID(), selected: true, title, bullets: [] })),
  };
}

function parsed(
  sections: ResumeSection[],
  contactOverrides: Partial<ContactInfo> = {}
): ParsedResume {
  return {
    resume: { schemaVersion: 1, contact: contact(contactOverrides), sections },
    warnings: [],
  };
}

function seed(data: ResumeData) {
  useResumeStore.getState().replaceResume(data);
}

describe('describeImport', () => {
  it('counts sections, entries, and bullets', () => {
    const result: ParsedResume = {
      resume: {
        schemaVersion: 1,
        contact: contact({ name: 'Ada' }),
        sections: [
          {
            id: 'x',
            type: 'experience',
            label: 'Work Experience',
            order: 0,
            items: [
              {
                id: 'e1',
                selected: true,
                title: 'Engineer',
                bullets: [
                  { id: 'b1', text: 'a', selected: true },
                  { id: 'b2', text: 'b', selected: true },
                ],
              },
            ],
          },
        ],
      },
      warnings: [],
    };
    expect(describeImport(result)).toEqual({
      sectionCount: 1,
      entryCount: 1,
      bulletCount: 2,
      contactName: 'Ada',
    });
  });
});

describe('applyImportedResume', () => {
  beforeEach(() => {
    seed({
      schemaVersion: 1,
      contact: contact({ name: 'Existing Person', email: 'keep@me.com' }),
      sections: [section('experience', 'Work Experience', ['Old Job'])],
    });
  });

  it('replace swaps the whole document', () => {
    applyImportedResume(
      parsed([section('education', 'Education', ['B.S. CS'])], { name: 'New Name' }),
      'replace'
    );
    const state = useResumeStore.getState();
    expect(state.sections.map((s) => s.type)).toEqual(['education']);
    expect(state.contact.name).toBe('New Name');
  });

  it('merge appends into same-type sections and adds new ones', () => {
    applyImportedResume(
      parsed([
        section('experience', 'Work Experience', ['New Job']),
        section('skills', 'Skills', ['TypeScript']),
      ]),
      'merge'
    );
    const state = useResumeStore.getState();
    const experience = state.sections.find((s) => s.type === 'experience');
    expect(experience?.items.map((i) => i.title)).toEqual(['Old Job', 'New Job']);
    expect(state.sections.some((s) => s.type === 'skills')).toBe(true);
  });

  it('merge fills only empty contact fields', () => {
    applyImportedResume(
      parsed([section('skills', 'Skills', ['Go'])], {
        name: 'Should Not Override',
        email: 'ignored@x.com',
        phone: '555-0000',
      }),
      'merge'
    );
    const { contact: result } = useResumeStore.getState();
    expect(result.name).toBe('Existing Person');
    expect(result.email).toBe('keep@me.com');
    expect(result.phone).toBe('555-0000');
  });
});
