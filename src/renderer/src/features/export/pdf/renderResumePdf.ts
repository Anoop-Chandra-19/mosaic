import type { PdfExportReply } from './pdfExport.worker';
import type { PdfExportRequest } from './renderPdfBytes';

/*
 * The PDF export. react-pdf lays the whole document out in one unbroken run of work, which
 * on a long resume froze the window for as long as it took. So it runs in a worker: the
 * dialog → `renderResumePdf` → `pdfExport.worker` → `renderPdfBytes` → `PdfResumeDocument`,
 * and the bytes come back. Other modules use only `renderResumePdf`.
 */

/** The resume as PDF file bytes, made off the window's thread. */
export async function renderResumePdf(request: PdfExportRequest): Promise<Uint8Array> {
  const { default: PdfExportWorker } = await import('./pdfExport.worker?worker');
  const worker = new PdfExportWorker();
  try {
    const reply = await new Promise<PdfExportReply>((resolve, reject) => {
      worker.onmessage = (event: MessageEvent<PdfExportReply>) => resolve(event.data);
      worker.onerror = (event) => reject(new Error(event.message || 'The PDF worker failed'));
      worker.postMessage(request);
    });
    if ('error' in reply) throw new Error(reply.error);
    return reply.bytes;
  } finally {
    worker.terminate();
  }
}
