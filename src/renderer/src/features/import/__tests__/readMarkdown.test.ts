import { describe, expect, it } from 'vitest';
import { createMarkdownExport } from '@/features/export/markdownExport';
import { normalizeResumeForExport } from '@/features/export/normalizeResumeExport';
import { createDefaultResume } from '@shared/resume/defaultResume';
import type { ResumeData } from '@shared/types/resume';
import { readMarkdown } from '../readMarkdown';
import {
  entry,
  everything,
  lines,
  resume,
  section,
  shown,
  buildExpectedShown,
  createStyledHeaderResume,
} from './roundTrip';

const markdownOf = (data: ResumeData) => createMarkdownExport(normalizeResumeForExport(data));

/** Text that Markdown would take as markup if it were written as it is. */
const LOOKS_LIKE_MARKUP = [
  'C# and F#',
  'Learn C #',
  '*stars* and **bold**',
  '_under_ and snake_case',
  '- starts with a dash',
  '+ starts with a plus',
  '1. starts with a number',
  '# starts with a hash',
  '> quoted',
  '---',
  '[link](https://ada.dev)',
  'back\\slash\\',
  '<b>tag</b>',
  '~~struck~~',
  '`code`',
  '_2025_',
];

describe('readMarkdown', () => {
  it('reads Mosaic’s own export back exactly', () => {
    for (const data of [everything(), createDefaultResume()]) {
      const parsed = readMarkdown(markdownOf(data));
      expect(shown(parsed.resume)).toEqual(shown(data));
      expect(parsed.warnings).toEqual([]);
      expect(parsed.leftOut).toEqual([]);
    }
  });

  it('gives back a header’s links and separators, but not alignment or underlining', () => {
    const data = createStyledHeaderResume();
    // Markdown has no way to set a line left or centred, or to say how a link looks.
    expect(shown(readMarkdown(markdownOf(data)).resume)).toEqual(
      buildExpectedShown(data, (expected) => {
        expected.linkStyle = 'plain';
        expected.header[0].align = 'center';
      })
    );
  });

  it('gives back text that looks like Markdown as it was typed', () => {
    const data = resume([
      section('custom', 'lines', 'C# & *Co* #', lines(...LOOKS_LIKE_MARKUP)),
      section(
        'custom',
        'entries',
        'Odd entries',
        LOOKS_LIKE_MARKUP.map((text) => entry({ title: text, subtitle: text, bullets: [text] }))
      ),
    ]);
    data.contact.name = 'Ada *the* Countess #';
    data.contact.header.lines[0].items[1].text = 'first_last@example.com';

    expect(shown(readMarkdown(markdownOf(data)).resume)).toEqual(shown(data));
  });

  it('reads other Markdown the same way, as far as it follows that shape', () => {
    const { resume: read, leftOut } = readMarkdown(
      [
        'Grace Hopper',
        '============',
        'grace@example.com · [Portfolio](https://grace.dev)',
        '',
        '## Experience',
        '',
        '### Rear Admiral, US Navy',
        '*Aug 1967 – 1986*',
        '',
        '- Standardized **COBOL**',
        '  across the Navy',
        '* Retired twice',
        '',
        '## Skills',
        '',
        '- COBOL',
        '- FLOW-MATIC',
        '',
        '## Talks',
        '1. Nanoseconds',
      ].join('\n')
    );

    expect(read.contact.name).toBe('Grace Hopper');
    expect(
      read.contact.header.lines.map((line) =>
        line.items.map((item) => [item.kind, item.text, item.url])
      )
    ).toEqual([
      [
        ['email', 'grace@example.com', ''],
        ['site', 'Portfolio', 'https://grace.dev'],
      ],
    ]);
    expect(
      read.sections.map(({ kind, layout, label, items }) => [
        kind,
        layout,
        label,
        items.map(
          (item) => item.text ?? [item.title, item.subtitle, item.bullets.map((b) => b.text)]
        ),
      ])
    ).toEqual([
      [
        'experience',
        'entries',
        'Experience',
        [
          [
            'Rear Admiral, US Navy',
            'Aug 1967 – 1986',
            ['Standardized COBOL across the Navy', 'Retired twice'],
          ],
        ],
      ],
      // A bulleted list with no entries in it is a list.
      ['skills', 'lines', 'Skills', ['COBOL', 'FLOW-MATIC']],
      ['custom', 'lines', 'Talks', ['Nanoseconds']],
    ]);
    expect(leftOut).toEqual([]);
  });

  it('takes a known section name on its own line as a heading when there are none', () => {
    const { resume: read } = readMarkdown('**Ada Lovelace**\n\n**Skills**\n\nMathematics');
    expect(read.contact.name).toBe('Ada Lovelace');
    expect(read.sections.map((s) => [s.label, s.items.map((i) => i.text)])).toEqual([
      ['Skills', ['Mathematics']],
    ]);
  });
});
