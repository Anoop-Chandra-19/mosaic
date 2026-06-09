import { describe, expect, it } from 'vitest';
import { normalizeResumeForExport } from '../normalizeResumeExport';
import type { ResumeData } from '@/types/resume';

function createResumeFixture(): ResumeData {
  return {
    schemaVersion: 1,
    contact: {
      name: '  Alex Johnson  ',
      email: ' alex@example.com ',
      phone: ' 555-0100 ',
      location: ' Detroit, MI ',
      linkedin: ' linkedin.com/in/alex ',
      github: ' github.com/alex ',
      website: ' alex.dev ',
      showLinkedin: false,
      showGithub: true,
      showWebsite: false,
    },
    sections: [
      {
        id: 'experience',
        type: 'experience',
        label: ' Experience ',
        order: 2,
        items: [
          {
            id: 'job-1',
            selected: true,
            title: ' Engineer ',
            subtitle: ' Mosaic ',
            bullets: [
              { id: 'b1', text: ' Built export flow ', selected: true },
              { id: 'b2', text: ' Hidden bullet ', selected: false },
              { id: 'b3', text: '   ', selected: true },
            ],
          },
          {
            id: 'job-2',
            selected: false,
            title: ' Excluded ',
            subtitle: '',
            bullets: [{ id: 'b4', text: 'Should not export', selected: true }],
          },
          {
            id: 'job-3',
            selected: true,
            title: ' ',
            subtitle: '',
            bullets: [],
          },
        ],
      },
      {
        id: 'summary',
        type: 'summary',
        label: ' Summary ',
        order: 1,
        items: [
          { id: 'summary-1', selected: true, text: '  Focused builder.  ', bullets: [] },
          { id: 'summary-2', selected: false, text: 'Hidden summary.', bullets: [] },
          { id: 'summary-3', selected: true, text: '   ', bullets: [] },
        ],
      },
      {
        id: 'empty-projects',
        type: 'projects',
        label: 'Projects',
        order: 3,
        items: [
          {
            id: 'project-1',
            selected: true,
            title: '',
            subtitle: '',
            bullets: [{ id: 'pb1', text: '   ', selected: true }],
          },
        ],
      },
    ],
  };
}

describe('normalizeResumeForExport', () => {
  it('trims contact fields and respects hidden contact links', () => {
    const normalized = normalizeResumeForExport(createResumeFixture());

    expect(normalized.contact).toEqual({
      name: 'Alex Johnson',
      email: 'alex@example.com',
      phone: '555-0100',
      location: 'Detroit, MI',
      linkedin: '',
      github: 'github.com/alex',
      website: '',
    });
  });

  it('sorts sections and removes unselected or empty content', () => {
    const normalized = normalizeResumeForExport(createResumeFixture());

    expect(normalized.sections).toEqual([
      {
        id: 'summary',
        type: 'summary',
        label: 'Summary',
        entries: [
          {
            id: 'summary-1',
            title: '',
            subtitle: '',
            text: 'Focused builder.',
            bullets: [],
          },
        ],
      },
      {
        id: 'experience',
        type: 'experience',
        label: 'Experience',
        entries: [
          {
            id: 'job-1',
            title: 'Engineer',
            subtitle: 'Mosaic',
            text: '',
            bullets: ['Built export flow'],
          },
        ],
      },
    ]);
  });

  it('keeps trimmed entry dates and drops absent or blank ones', () => {
    const resume = createResumeFixture();
    resume.sections[0].items[0].startDate = ' 2023-06 ';
    resume.sections[0].items[0].endDate = '   ';

    const normalized = normalizeResumeForExport(resume);
    const entry = normalized.sections.find((s) => s.type === 'experience')!.entries[0];

    expect(entry.startDate).toBe('2023-06');
    expect(entry.endDate).toBeUndefined();
  });

  it('never carries dates on text-only sections', () => {
    const resume = createResumeFixture();
    resume.sections[1].items[0].startDate = '2023-06';

    const normalized = normalizeResumeForExport(resume);
    const entry = normalized.sections.find((s) => s.type === 'summary')!.entries[0];

    expect(entry.startDate).toBeUndefined();
  });
});
