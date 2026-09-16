import { describe, expect, it } from 'vitest';
import { createMarkdownExport } from '../markdown';
import type { NormalizedResumeExport } from '../normalizeResumeExport';
import type { PrintedHeaderLine } from '@/lib/resume/resumeHeader';

const line = (
  texts: string[],
  separator: PrintedHeaderLine['separator'] = ' | '
): PrintedHeaderLine => ({
  id: texts.join(),
  separator,
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

describe('createMarkdownExport', () => {
  it('formats contact lines, sections, text entries, and bullet entries', () => {
    expect(createMarkdownExport(exportData)).toBe(`# Alex Johnson
555-0100 | alex@example.com | linkedin.com/in/alex | github.com/alex
Detroit, MI

## Summary

Focused builder.

## Experience

### Engineer
_Mosaic_
- Built export flow
- Improved preview accuracy`);
  });

  it('writes each header line with its own separator', () => {
    expect(
      createMarkdownExport({
        contact: {
          name: 'Alex',
          linkStyle: 'plain',
          lines: [line(['US Citizen', 'Detroit, MI'], ' · '), line(['a', 'b'], '    ')],
        },
        sections: [],
      })
    ).toBe('# Alex\nUS Citizen · Detroit, MI\na    b');
  });

  it('uses the Mosaic Resume fallback name', () => {
    expect(
      createMarkdownExport({
        contact: { name: '', linkStyle: 'plain', lines: [] },
        sections: [],
      })
    ).toBe('# Mosaic Resume');
  });
});
