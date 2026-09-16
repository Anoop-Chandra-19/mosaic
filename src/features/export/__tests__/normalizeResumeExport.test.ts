import { describe, expect, it } from 'vitest';
import { normalizeResumeForExport } from '../normalizeResumeExport';
import { getContactLines } from '@/lib/resume/contactFormatting';
import type { ResumeData } from '@/types/resume';

function createResumeFixture(): ResumeData {
  return {
    schemaVersion: 1,
    contact: {
      name: '  Alex Johnson  ',
      email: ' alex@example.com ',
      phone: ' 555-0100 ',
      location: ' Detroit, MI ',
      citizenshipStatus: '',
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
        kind: 'experience',
        layout: 'entries',
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
        kind: 'summary',
        layout: 'lines',
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
        kind: 'projects',
        layout: 'entries',
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
      citizenshipStatus: '',
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
        kind: 'summary',
        layout: 'lines',
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
        kind: 'experience',
        layout: 'entries',
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
});

describe('getContactLines', () => {
  const base = createResumeFixture().contact;

  it('puts phone first and keeps visible links on the contact line', () => {
    const { primary } = getContactLines(base);

    expect(primary).toBe('555-0100 | alex@example.com | github.com/alex');
  });

  it('leaves location off the contact line', () => {
    expect(getContactLines(base).primary).not.toContain('Detroit');
  });

  it('joins work authorization and location with a pipe', () => {
    const { secondary } = getContactLines({
      ...base,
      citizenshipStatus: 'F-1 STEM OPT, work authorized through July 2028',
      location: 'Cleveland, OH',
    });

    expect(secondary).toBe('F-1 STEM OPT, work authorized through July 2028 | Cleveland, OH');
  });

  it('falls back to whichever half is present', () => {
    expect(
      getContactLines({ ...base, citizenshipStatus: '', location: 'Cleveland, OH' }).secondary
    ).toBe('Cleveland, OH');
    expect(
      getContactLines({ ...base, citizenshipStatus: 'US Citizen', location: '' }).secondary
    ).toBe('US Citizen');
    expect(getContactLines({ ...base, citizenshipStatus: '', location: '' }).secondary).toBe('');
  });
});
