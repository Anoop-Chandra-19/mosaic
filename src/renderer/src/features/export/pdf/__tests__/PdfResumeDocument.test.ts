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

describe('PdfResumeDocument', () => {
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
