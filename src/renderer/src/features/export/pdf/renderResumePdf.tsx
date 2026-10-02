import { HEADLESS_LAYOUT } from '@/lib/resume/headlessLayout';
import type { PaperSize } from '@/types/paper';
import type { NormalizedResumeExport } from '../normalizeResumeExport';
import { createTextMeasurer } from './breakLinesLikeWord';

interface RenderResumePdfOptions {
  data: NormalizedResumeExport;
  paperSize: PaperSize;
}

/** The resume as PDF file bytes. */
export async function renderResumePdf(options: RenderResumePdfOptions): Promise<Uint8Array> {
  // Lazy-load PDF rendering so the editor stays lighter on initial load.
  const [{ pdf }, { PdfResumeDocument }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('./PdfResumeDocument'),
  ]);
  const body = createTextMeasurer(HEADLESS_LAYOUT.bodyFontSize);
  const contact = createTextMeasurer(HEADLESS_LAYOUT.contactFontSize);
  const blob = await pdf(
    <PdfResumeDocument
      data={options.data}
      paperSize={options.paperSize}
      measurers={body && contact ? { body, contact } : null}
    />
  ).toBlob();
  return new Uint8Array(await blob.arrayBuffer());
}
