import { describe, expect, it } from 'vitest';
import { createPlaintextExport } from '../plaintext';
import type { NormalizedResumeExport } from '../normalizeResumeExport';
import type { PrintedHeaderLine } from '@/lib/resume/resumeHeader';

const line = (texts: string[]): PrintedHeaderLine => ({
  id: texts.join(),
  separator: ' | ',
  align: 'center',
  items: texts.map((text) => ({ id: text, kind: 'custom', text, href: '' })),
});

const exportData: NormalizedResumeExport = {
  contact: {
    name: 'Alex Johnson',
    linkStyle: 'plain',
    lines: [
      line(['555-0100', 'alex@example.com', 'linkedin.com/in/alex', 'github.com/alex']),
      line(['Detroit, MI']),
    ],
  },
  sections: [
    {
      id: 'summary',
      kind: 'summary',
      layout: 'lines',
      label: 'Summary',
      entries: [
        { id: 'summary-1', title: '', subtitle: '', text: 'Focused builder.', bullets: [] },
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
        contact: { name: '', linkStyle: 'plain', lines: [] },
        sections: [],
      })
    ).toBe('Mosaic Resume');
  });
});
