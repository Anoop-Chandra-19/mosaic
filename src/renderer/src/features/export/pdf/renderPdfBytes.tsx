import { pdf } from '@react-pdf/renderer';
import { RESUME_LAYOUT } from '@/lib/resume/resumeLayout';
import type { PaperSize } from '@/types/paper';
import type { NormalizedResumeExport } from '@/lib/resume/normalizeResumeExport';
import { createTextMeasurer } from '@/lib/resume/breakLinesLikeWord';
import { PdfResumeDocument } from './PdfResumeDocument';

export interface PdfExportRequest {
  data: NormalizedResumeExport;
  paperSize: PaperSize;
}

/** The resume as PDF file bytes. Runs in the export worker (`pdfExport.worker`). */
export async function renderPdfBytes({ data, paperSize }: PdfExportRequest): Promise<Uint8Array> {
  const body = createTextMeasurer(RESUME_LAYOUT.bodyFontSize);
  const contact = createTextMeasurer(RESUME_LAYOUT.contactFontSize);
  const blob = await pdf(
    <PdfResumeDocument
      data={data}
      paperSize={paperSize}
      measurers={body && contact ? { body, contact } : null}
    />
  ).toBlob();
  return new Uint8Array(await blob.arrayBuffer());
}
