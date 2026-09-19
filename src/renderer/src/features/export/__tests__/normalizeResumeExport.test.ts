import { describe, expect, it } from 'vitest';
import { normalizeResumeForExport } from '../normalizeResumeExport';
import type { ResumeData } from '@shared/types/resume';

function createResumeFixture(): ResumeData {
  return {
    schemaVersion: 1,
    contact: {
      name: '  Alex Johnson  ',
      header: {
        linkStyle: 'underline',
        lines: [
          {
            id: 'reach',
            separator: ' · ',
            align: 'left',
            items: [
              { id: 'phone', kind: 'phone', text: ' 555-0100 ', url: '555-0100', shown: true },
              {
                id: 'li',
                kind: 'linkedin',
                text: 'LinkedIn',
                url: 'linkedin.com/in/a',
                shown: false,
              },
              { id: 'gh', kind: 'github', text: '', url: 'github.com/alex', shown: true },
            ],
          },
          {
            id: 'hidden',
            separator: ' | ',
            align: 'center',
            items: [{ id: 'auth', kind: 'auth', text: 'US Citizen', url: '', shown: false }],
          },
        ],
      },
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
            organization: ' Mosaic ',
            location: ' ',
            dates: ' 2024 ',
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
            bullets: [{ id: 'b4', text: 'Should not export', selected: true }],
          },
          {
            id: 'job-3',
            selected: true,
            title: ' ',
            dates: '',
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
            bullets: [{ id: 'pb1', text: '   ', selected: true }],
          },
        ],
      },
    ],
  };
}

describe('normalizeResumeForExport', () => {
  it('leaves out a section that is left off the resume, whatever its entries say', () => {
    const resume = createResumeFixture();
    resume.sections[0].hidden = true;

    const normalized = normalizeResumeForExport(resume);
    expect(normalized.sections.map((section) => section.id)).toEqual(['summary']);
  });

  it('keeps only the header that prints: shown items with text, lines with items', () => {
    const normalized = normalizeResumeForExport(createResumeFixture());

    expect(normalized.contact).toEqual({
      name: 'Alex Johnson',
      linkStyle: 'underline',
      linkColor: 'ink',
      lines: [
        {
          id: 'reach',
          separator: ' · ',
          align: 'left',
          items: [{ id: 'phone', kind: 'phone', text: '555-0100', href: 'tel:5550100' }],
        },
      ],
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
            organization: '',
            location: '',
            dates: '',
            heading: '',
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
            organization: 'Mosaic',
            location: '',
            dates: '2024',
            // The parts that have something in them, as they print.
            heading: 'Engineer, Mosaic',
            text: '',
            bullets: ['Built export flow'],
          },
        ],
      },
    ]);
  });
});
