import { createElement } from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { describe, expect, it } from 'vitest';
import { createDefaultResume } from '@shared/resume/defaultResume';
import type { ResumeData } from '@shared/types/resume';
import { extractPdfText } from '../../../../../../../e2e/pdfText';
import { readPdfContent } from '@/features/import/readers/pdf/readPdf';
import {
  createStyledHeaderResume,
  entry,
  resume,
  section,
} from '@/features/import/__tests__/resumeFixtures';
import { HEADLESS_LAYOUT, PAPER_SIZE_PT } from '@/lib/resume/headlessLayout';
import { normalizeResumeForExport } from '../../normalizeResumeExport';
import { PdfResumeDocument } from '../PdfResumeDocument';

const renderPdf = async (data: ResumeData) =>
  new Uint8Array(
    await renderToBuffer(
      createElement(PdfResumeDocument, {
        data: normalizeResumeForExport(data),
        paperSize: 'letter',
      }) as Parameters<typeof renderToBuffer>[0]
    )
  );

/** Enough entries, each with bullets that wrap, to break over several pages. */
function manyEntriesResume(): ResumeData {
  const bullet = (n: number) =>
    `Wrote program ${n} for the analytical engine, checking every step of it by hand against the tables computed the long way, and noted what the engine did differently.`;
  return resume([
    section(
      'experience',
      'entries',
      'Work History',
      Array.from({ length: 12 }, (_, i) =>
        entry({
          title: 'Analyst',
          organization: `Engine Works ${i + 1}`,
          location: 'London, UK',
          dates: `18${40 + i} to 18${41 + i}`,
          bullets: Array.from({ length: 3 }, (_, j) => bullet(i * 3 + j)),
        })
      )
    ),
  ]);
}

const LONG_HEADING = {
  title: 'Senior Software Engineer',
  organization: 'Fictional Institute for Distributed Systems and Infrastructure',
  location: 'Example City',
  dates: 'January 2020 to September 2026',
};

describe('PdfResumeDocument', () => {
  it.each(['a4', 'letter'] as const)(
    'wraps a long entry heading beside its dates, inside the margin (%s)',
    async (paperSize) => {
      const data = resume([
        section('experience', 'entries', 'Experience', [
          entry({ ...LONG_HEADING, bullets: ['Kept the lights on.'] }),
        ]),
      ]);
      const pdf = new Uint8Array(
        await renderToBuffer(
          createElement(PdfResumeDocument, {
            data: normalizeResumeForExport(data),
            paperSize,
          }) as Parameters<typeof renderToBuffer>[0]
        )
      );
      const [page] = (await readPdfContent(pdf)).pages;
      const runs = page.runs.filter((run) => run.text.trim());
      const dates = runs.find((run) => run.text.includes('January 2020'))!;
      const rightMargin = PAPER_SIZE_PT[paperSize].width - HEADLESS_LAYOUT.marginSide;

      expect(dates.x + dates.width).toBeLessThanOrEqual(rightMargin + 0.5);
      const besideDates = runs.filter((run) => Math.abs(run.y - dates.y) < 1 && run !== dates);
      for (const run of besideDates) expect(run.x + run.width).toBeLessThan(dates.x);
      const heading = runs.filter((run) => run.italic && run !== dates);
      expect(heading.length).toBeGreaterThan(1);
      expect(heading.map((run) => run.text.trim()).join(' ')).toBe(
        'Senior Software Engineer, Fictional Institute for Distributed Systems and Infrastructure, Example City'
      );
    }
  );

  it('never splits a word across lines', async () => {
    const resume = createDefaultResume();
    // Long words that react-pdf's hyphenation would break at a syllable.
    resume.sections[1].items[0].bullets[0].text =
      'Reimplemented the incomprehensibilities of the synchronization subsystem so that characteristically uncharacteristic workloads finished noticeably faster than before';
    const pdf = await renderToBuffer(
      createElement(PdfResumeDocument, {
        data: normalizeResumeForExport(resume),
        paperSize: 'letter',
      }) as Parameters<typeof renderToBuffer>[0]
    );

    const lines = extractPdfText(pdf).split('\n');
    expect(lines).toContain('customers could finish a task on screen instead of filing paperwork.');
    expect(lines.filter((line) => /\p{L}-$/u.test(line))).toEqual([]);
  });

  it('carries a bullet no page can hold onto the next, inside the margins and without a marker', async () => {
    const words = Array.from({ length: 700 }, (_, i) => `w${i}`);
    const data = resume([
      section('experience', 'entries', 'Experience', [
        entry({ ...LONG_HEADING, bullets: ['Kept the lights on.', words.join(' ')] }),
      ]),
    ]);
    // Wider than Helvetica, so react-pdf keeps the lines as given.
    const measure = (text: string) => text.length * 6.5;
    const pdf = new Uint8Array(
      await renderToBuffer(
        createElement(PdfResumeDocument, {
          data: normalizeResumeForExport(data),
          paperSize: 'letter',
          measurers: { body: measure, contact: measure },
        }) as Parameters<typeof renderToBuffer>[0]
      )
    );
    const pages = (await readPdfContent(pdf)).pages.map((page) =>
      page.runs.filter((run) => run.text.trim())
    );

    expect(pages.length).toBeGreaterThan(1);
    const bottom = PAPER_SIZE_PT.letter.height - HEADLESS_LAYOUT.marginBottom;
    for (const runs of pages) {
      expect(runs.length).toBeGreaterThan(0);
      for (const run of runs) expect(run.y).toBeLessThan(bottom);
    }
    const printed = pages.flat().flatMap((run) => run.text.match(/\bw\d+\b/g) ?? []);
    expect(printed).toEqual(words);
    expect(pages.flat().filter((run) => run.text.trim() === '•')).toHaveLength(2);
    const textLeft = HEADLESS_LAYOUT.marginSide + HEADLESS_LAYOUT.bulletTextIndent;
    for (const runs of pages.slice(1)) {
      for (const run of runs) expect(run.x).toBeCloseTo(textLeft, 0);
    }
  }, 30_000);

  it('breaks pages where the preview does: whole bullets, and no stranded entry line', async () => {
    // The sample resume broke a bullet over the page; the rest is long enough to break again.
    const sample = createDefaultResume();
    sample.contact.header = createStyledHeaderResume().contact.header;
    const pages = [
      ...(await readPdfContent(await renderPdf(sample))).pages,
      ...(await readPdfContent(await renderPdf(manyEntriesResume()))).pages,
    ];
    expect(pages.length).toBeGreaterThan(4);

    for (const page of pages) {
      const rows = page.runs.filter((run) => run.text.trim());
      // Every bullet marker keeps its own text beside it, rather than the text moving on
      // to the next page without it.
      for (const marker of rows.filter((run) => run.text.trim() === '•')) {
        const beside = rows.filter((run) => Math.abs(run.y - marker.y) < 1 && run.x > marker.x);
        expect(beside.length).toBeGreaterThan(0);
      }
      // An entry's italic line has bullets under it here, so it can never be last.
      const last = rows.reduce((lowest, run) => (run.y > lowest.y ? run : lowest), rows[0]);
      expect(last.italic).toBe(false);
    }
  }, 30_000);
});
