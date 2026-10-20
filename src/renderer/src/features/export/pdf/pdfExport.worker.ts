import { renderPdfBytes, type PdfExportRequest } from './renderPdfBytes';

/** What the worker answers: the file's bytes, or why there are none. */
export type PdfExportReply = { bytes: Uint8Array } | { error: string };

function reply(answer: PdfExportReply, transfer: Transferable[] = []) {
  self.postMessage(answer, { transfer });
}

self.onmessage = async (event: MessageEvent<PdfExportRequest>) => {
  try {
    const bytes = await renderPdfBytes(event.data);
    // Handed over, not copied.
    reply({ bytes }, [bytes.buffer]);
  } catch (error) {
    reply({ error: error instanceof Error ? error.message : String(error) });
  }
};
