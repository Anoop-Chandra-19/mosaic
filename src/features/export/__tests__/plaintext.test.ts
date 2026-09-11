import { describe, expect, it } from 'vitest';
import { createPlaintextExport } from '../plaintext';
import type { NormalizedResumeExport } from '../normalizeResumeExport';

const exportData: NormalizedResumeExport = {
  contact: {
    name: 'Alex Johnson',
    email: 'alex@example.com',
    phone: '555-0100',
    location: 'Detroit, MI',
    citizenshipStatus: '',
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

describe('createPlaintextExport', () => {
  it('formats readable plaintext with uppercase section labels', () => {
    expect(createPlaintextExport(exportData)).toBe(`Alex Johnson
555-0100 | alex@example.com | linkedin.com/in/alex | github.com/alex
Detroit, MI

SUMMARY
Focused builder.

EXPERIENCE
Engineer | Mosaic
- Built export flow
- Improved preview accuracy`);
  });

  it('uses the Mosaic Resume fallback name', () => {
    expect(
      createPlaintextExport({
        contact: {
          name: '',
          email: '',
          phone: '',
          location: '',
          citizenshipStatus: '',
          linkedin: '',
          github: '',
          website: '',
        },
        sections: [],
      })
    ).toBe('Mosaic Resume');
  });
});
