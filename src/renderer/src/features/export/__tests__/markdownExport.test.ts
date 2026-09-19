import { describe, expect, it } from 'vitest';
import { createMarkdownExport } from '../markdownExport';
import type { NormalizedResumeExport } from '../normalizeResumeExport';
import type { PrintedHeaderLine } from '@shared/resume/resumeHeader';
import { createExportEntry } from './exportEntries';

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

describe('createMarkdownExport', () => {
  it('formats contact lines, sections, text entries, and bullet entries', () => {
    expect(createMarkdownExport(exportData)).toBe(`# Alex Johnson
555-0100 | alex@example.com | linkedin.com/in/alex | github.com/alex
Detroit, MI

## Summary

Focused builder.

## Experience

### Engineer, Mosaic, Detroit, MI
_Jan 2021 to Current_
- Built export flow
- Improved preview accuracy`);
  });

  it('escapes a comma inside a title or organization, not inside the location', () => {
    const markdown = createMarkdownExport({
      contact: { name: 'Alex', linkStyle: 'plain', linkColor: 'ink', lines: [] },
      sections: [
        {
          id: 'experience',
          kind: 'experience',
          layout: 'entries',
          label: 'Experience',
          entries: [
            createExportEntry('job', {
              title: 'Engineer, Platform',
              organization: 'Babbage & Co, Ltd',
              location: 'London, UK',
            }),
          ],
        },
      ],
    });
    expect(markdown).toContain('### Engineer\\, Platform, Babbage & Co\\, Ltd, London, UK');
  });

  it('writes each header line with its own separator', () => {
    expect(
      createMarkdownExport({
        contact: {
          name: 'Alex',
          linkStyle: 'plain',
          linkColor: 'ink',
          lines: [line(['US Citizen', 'Detroit, MI'], ' · '), line(['a', 'b'], '    ')],
        },
        sections: [],
      })
    ).toBe('# Alex\nUS Citizen · Detroit, MI\na    b');
  });

  it('uses the Mosaic Resume fallback name', () => {
    expect(
      createMarkdownExport({
        contact: { name: '', linkStyle: 'plain', linkColor: 'ink', lines: [] },
        sections: [],
      })
    ).toBe('# Mosaic Resume');
  });
});
