import { describe, expect, it } from 'vitest';
import { createPlaintextExport } from '../plaintextExport';
import type { NormalizedResumeExport } from '../normalizeResumeExport';
import type { PrintedHeaderLine } from '@shared/resume/resumeHeader';
import { createExportEntry } from './exportEntries';

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
    linkColor: 'ink',
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
      entries: [createExportEntry('summary-1', { text: 'Focused builder.' })],
    },
    {
      id: 'experience',
      kind: 'experience',
      layout: 'entries',
      label: 'Experience',
      entries: [
        createExportEntry('job-1', {
          title: 'Engineer',
          organization: 'Mosaic',
          location: 'Detroit, MI',
          dates: 'Jan 2021 to Current',
          bullets: ['Built export flow', 'Improved preview accuracy'],
        }),
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
Engineer, Mosaic, Detroit, MI | Jan 2021 to Current
- Built export flow
- Improved preview accuracy`);
  });

  it('uses the Mosaic Resume fallback name', () => {
    expect(
      createPlaintextExport({
        contact: { name: '', linkStyle: 'plain', linkColor: 'ink', lines: [] },
        sections: [],
      })
    ).toBe('Mosaic Resume');
  });
});
