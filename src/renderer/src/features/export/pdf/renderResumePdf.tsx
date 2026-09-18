import type { PaperSize } from '@/types/ui';
import type { NormalizedResumeExport } from '../normalizeResumeExport';

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
  const blob = await pdf(
    <PdfResumeDocument data={options.data} paperSize={options.paperSize} />
  ).toBlob();
  return new Uint8Array(await blob.arrayBuffer());
}
