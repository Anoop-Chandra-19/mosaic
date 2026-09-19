import { createElement as h } from 'react';
import { Document, Link, Page, renderToBuffer, Text } from '@react-pdf/renderer';
import { describe, expect, it } from 'vitest';
import { normalizeResumeForExport } from '@/features/export/normalizeResumeExport';
import { PdfResumeDocument } from '@/features/export/pdf/PdfResumeDocument';
import { createDefaultResume } from '@shared/resume/defaultResume';
import type { ResumeData } from '@shared/types/resume';
import {
  entry,
  everything,
  resume,
  section,
  shown,
  createStyledHeaderResume,
} from '../../../__tests__/resumeFixtures';
import {
  NotAPdfError,
  PDF_LIMITS,
  PdfHasNoTextError,
  PdfLimitError,
  PdfPasswordError,
  readPdf,
  readPdfContent,
} from '../readPdf';
import { buildPdf } from './buildPdf';

type Renderable = Parameters<typeof renderToBuffer>[0];

async function exportedPdf(data: ResumeData, paperSize: 'letter' | 'a4' = 'letter') {
  const document = h(PdfResumeDocument, { data: normalizeResumeForExport(data), paperSize });
  return new Uint8Array(await renderToBuffer(document as Renderable));
}

/** A resume long enough to run onto more pages, with bullets that wrap. */
function longResume(): ResumeData {
  const bullet = (n: number) =>
    `Wrote program ${n} for the analytical engine, checking every step of it by hand against tables computed the long way.`;
  return resume([
    section(
      'experience',
      'entries',
      'Work History',
      Array.from({ length: 8 }, (_, i) =>
        entry({
          title: 'Analyst',
          organization: `Engine Works ${i + 1}`,
          location: 'London, UK',
          dates: `18${40 + i} to 18${41 + i}`,
          bullets: Array.from({ length: 5 }, (_, j) => bullet(i * 5 + j)),
        })
      )
    ),
  ]);
}

describe('readPdf', () => {
  it('reads Mosaic’s own PDF back as the resume it was made from', async () => {
    for (const data of [createDefaultResume(), everything(), longResume()]) {
      for (const paperSize of ['letter', 'a4'] as const) {
        const parsed = await readPdf(await exportedPdf(data, paperSize));
        expect(shown(parsed.resume)).toEqual(shown(data));
        expect(parsed.warnings).toEqual([]);
        expect(parsed.leftOut).toEqual([]);
      }
    }
  }, 60_000);

  it('gives back a header’s links, separators, alignment, and underlining', async () => {
    const data = createStyledHeaderResume();
    expect(data.contact.header.linkStyle).toBe('underline');
    const parsed = await readPdf(await exportedPdf(data));
    // The underline is a line drawn under the words, found among the page's drawings.
    expect(shown(parsed.resume)).toEqual(shown(data));

    const plain = createStyledHeaderResume();
    plain.contact.header.linkStyle = 'plain';
    expect((await readPdf(await exportedPdf(plain))).resume.contact.header.linkStyle).toBe('plain');
  });

  it('keeps a link’s address with the words it is set on', async () => {
    const linked = (src: string, words: string) =>
      h(Link, { src, style: { color: 'black', textDecoration: 'none' } }, words);
    const document = h(
      Document,
      null,
      h(
        Page,
        { size: 'LETTER', style: { padding: 72, fontFamily: 'Helvetica', fontSize: 11 } },
        h(Text, null, 'Ada Lovelace'),
        h(
          Text,
          null,
          '555-0100 | ',
          linked('mailto:ada@example.com', 'ada@example.com'),
          ' | ',
          linked('https://linkedin.com/in/ada', 'LinkedIn')
        )
      )
    );
    const bytes = new Uint8Array(await renderToBuffer(document as Renderable));

    const [page] = (await readPdfContent(bytes)).pages;
    expect(page.links.map((link) => link.url)).toEqual([
      'mailto:ada@example.com',
      'https://linkedin.com/in/ada',
    ]);
    const { resume: read, leftOut } = await readPdf(bytes);
    expect(read.contact.name).toBe('Ada Lovelace');
    expect(
      read.contact.header.lines.map((line) =>
        line.items.map(({ kind, text, url }) => [kind, text, url])
      )
    ).toEqual([
      [
        ['phone', '555-0100', ''],
        ['email', 'ada@example.com', 'mailto:ada@example.com'],
        ['linkedin', 'LinkedIn', 'https://linkedin.com/in/ada'],
      ],
    ]);
    expect(leftOut).toEqual([]);
  });

  it('finds underlines drawn as Word draws them: a filled bar, or a line in a moved space', async () => {
    // Helvetica 11pt at y = 700: "ada@example.com" is 94.9 points wide, " | " 9, and
    // "LinkedIn" 41.6, from x = 150.
    const content = [
      'BT /F1 16 Tf 150 730 Td (Ada Lovelace) Tj ET',
      'BT /F1 11 Tf 150 700 Td (ada@example.com | LinkedIn) Tj ET',
      // Blue ink, and a thin filled bar under the address.
      '0 0 1 rg 150 698.3 94.9 0.6 re f',
      // A stroked line under "LinkedIn", drawn in a space moved 100 points right.
      'q 1 0 0 1 100 0 cm 0 0 1 RG 0.6 w 153.9 698.6 m 195.5 698.6 l S Q',
      'BT /F1 12 Tf 150 660 Td (Experience) Tj ET',
      'BT /F1 11 Tf 150 640 Td (Engineer at Engine Works) Tj ET',
    ].join('\n');
    const links = [
      {
        rect: [150, 696, 244.9, 710] as [number, number, number, number],
        url: 'mailto:ada@example.com',
      },
      {
        rect: [253.9, 696, 295.5, 710] as [number, number, number, number],
        url: 'https://linkedin.com/in/ada',
      },
    ];
    const bytes = buildPdf({ pages: [content], hasFont: true, links: [links] });

    const [page] = (await readPdfContent(bytes)).pages;
    expect(page.rules).toHaveLength(2);
    const { resume: read } = await readPdf(bytes);
    expect(read.contact.header.linkStyle).toBe('underline');
    expect(read.contact.header.lines[0].items.map((item) => item.url)).toEqual([
      'mailto:ada@example.com',
      'https://linkedin.com/in/ada',
    ]);

    // The same page without the underlines has plain links.
    const bare = content
      .split('\n')
      .filter((line) => !/ re f| S Q/.test(line))
      .join('\n');
    const plain = await readPdf(buildPdf({ pages: [bare], hasFont: true, links: [links] }));
    expect(plain.resume.contact.header.linkStyle).toBe('plain');
  });

  it('says what is wrong with a PDF it cannot read', async () => {
    await expect(readPdf(buildPdf())).rejects.toThrow(PdfHasNoTextError);
    await expect(readPdf(buildPdf({ locked: true }))).rejects.toThrow(PdfPasswordError);
    await expect(readPdf(new TextEncoder().encode('not a PDF at all'))).rejects.toThrow(
      NotAPdfError
    );
    const pages = Array.from({ length: PDF_LIMITS.pages + 1 }, () => '72 72 m 90 90 l S');
    await expect(readPdf(buildPdf({ pages }))).rejects.toThrow(PdfLimitError);
  });
});
