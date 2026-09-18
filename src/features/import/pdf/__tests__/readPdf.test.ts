import { createElement as h } from 'react';
import { Document, Link, Page, renderToBuffer, Text } from '@react-pdf/renderer';
import { describe, expect, it } from 'vitest';
import { normalizeResumeForExport } from '@/features/export/normalizeResumeExport';
import { PDFResumeDocument } from '@/features/export/pdf/document';
import { createDefaultResume } from '@/lib/resume/defaultResume';
import type { ResumeData } from '@/types/resume';
import {
  entry,
  everything,
  resume,
  section,
  shown,
  buildExpectedShown,
  createStyledHeaderResume,
} from '../../__tests__/roundTrip';
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
  const document = h(PDFResumeDocument, { data: normalizeResumeForExport(data), paperSize });
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
          title: `Analyst at Engine Works ${i + 1}`,
          subtitle: `18${40 + i} to 18${41 + i}`,
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

  it('gives back a header’s links, separators and alignment, but not underlining', async () => {
    const data = createStyledHeaderResume();
    const parsed = await readPdf(await exportedPdf(data));
    // An underline is a line drawn under the words, which pdf.js's text doesn't carry.
    expect(shown(parsed.resume)).toEqual(
      buildExpectedShown(data, (expected) => {
        expected.linkStyle = 'plain';
      })
    );
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
