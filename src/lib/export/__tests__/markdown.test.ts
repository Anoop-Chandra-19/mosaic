import { describe, expect, it } from 'vitest';
import { createMarkdownExport } from '../markdown';
import type { NormalizedResumeExport } from '../normalizeResumeExport';

const exportData: NormalizedResumeExport = {
  contact: {
    name: 'Alex Johnson',
    email: 'alex@example.com',
    phone: '555-0100',
    location: 'Detroit, MI',
    linkedin: 'linkedin.com/in/alex',
    github: 'github.com/alex',
    website: '',
  },
  sections: [
    {
      id: 'summary',
      type: 'summary',
      label: 'Summary',
      entries: [
        { id: 'summary-1', title: '', subtitle: '', text: 'Focused builder.', bullets: [] },
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
          bullets: ['Built export flow', 'Improved preview accuracy'],
        },
      ],
    },
  ],
};

describe('createMarkdownExport', () => {
  it('formats contact lines, sections, text entries, and bullet entries', () => {
    expect(createMarkdownExport(exportData)).toBe(`# Alex Johnson
alex@example.com | 555-0100 | Detroit, MI
linkedin.com/in/alex | github.com/alex

## Summary

Focused builder.

## Experience

### Engineer - Mosaic
- Built export flow
- Improved preview accuracy`);
  });

  it('uses the Mosaic Resume fallback name', () => {
    expect(
      createMarkdownExport({
        contact: {
          name: '',
          email: '',
          phone: '',
          location: '',
          linkedin: '',
          github: '',
          website: '',
        },
        sections: [],
      })
    ).toBe('# Mosaic Resume');
  });
});
