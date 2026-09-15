import { describe, expect, it } from 'vitest';
import type { ContactInfo, ResumeData, ResumeSection } from '@/types/resume';
import { buildImportedResume, describeImport } from '../buildImportedResume';
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

describe('buildImportedResume', () => {
  const current: ResumeData = {
    schemaVersion: 1,
    contact: contact({ name: 'Existing Person', email: 'keep@me.com' }),
    sections: [section('experience', 'Work Experience', ['Old Job'])],
  };

  it('new and replace take the imported document as it is', () => {
    const imported = parsed([section('education', 'Education', ['B.S. CS'])], {
      name: 'New Name',
    });
    for (const mode of ['new', 'replace'] as const) {
      const result = buildImportedResume(current, imported, mode);
      expect(result.sections.map((s) => s.type)).toEqual(['education']);
      expect(result.contact.name).toBe('New Name');
    }
  });

  it('merge appends into same-type sections and adds new ones', () => {
    const result = buildImportedResume(
      current,
      parsed([
        section('experience', 'Work Experience', ['New Job']),
        section('skills', 'Skills', ['TypeScript']),
      ]),
      'merge'
    );
    const experience = result.sections.find((s) => s.type === 'experience');
    expect(experience?.items.map((i) => i.title)).toEqual(['Old Job', 'New Job']);
    expect(result.sections.some((s) => s.type === 'skills')).toBe(true);
    // The document it merged into is left alone.
    expect(current.sections[0].items.map((i) => i.title)).toEqual(['Old Job']);
  });

  it('merge puts a custom section into the one of the same name, not any custom section', () => {
    const withCustom: ResumeData = {
      ...current,
      sections: [...current.sections, section('custom', 'Volunteering', ['Food bank'])],
    };
    const result = buildImportedResume(
      withCustom,
      parsed([
        section('custom', 'volunteering ', ['Shelter']),
        section('custom', 'Publications', ['A paper']),
      ]),
      'merge'
    );
    const custom = result.sections.filter((s) => s.type === 'custom');
    expect(custom.map((s) => [s.label, s.items.map((i) => i.title)])).toEqual([
      ['Volunteering', ['Food bank', 'Shelter']],
      ['Publications', ['A paper']],
    ]);
  });

  it('merge fills only empty contact fields', () => {
    const { contact: result } = buildImportedResume(
      current,
      parsed([section('skills', 'Skills', ['Go'])], {
        name: 'Should Not Override',
        email: 'ignored@x.com',
        phone: '555-0000',
      }),
      'merge'
    );
    expect(result.name).toBe('Existing Person');
    expect(result.email).toBe('keep@me.com');
    expect(result.phone).toBe('555-0000');
  });
});
