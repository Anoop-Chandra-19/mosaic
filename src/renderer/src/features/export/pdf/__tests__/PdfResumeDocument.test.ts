import { createElement } from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { describe, expect, it } from 'vitest';
import { createDefaultResume } from '@shared/resume/defaultResume';
import { extractPdfText } from '../../../../../../../e2e/pdfText';
import { normalizeResumeForExport } from '../../normalizeResumeExport';
import { PdfResumeDocument } from '../PdfResumeDocument';

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
});
