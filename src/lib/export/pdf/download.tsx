import { pdf } from '@react-pdf/renderer';
import type { PaperSize } from '@/types/ui';
import type { NormalizedResumeExport } from '../normalizeResumeExport';
import { PDFResumeDocument } from './document';

interface DownloadResumePdfOptions {
  data: NormalizedResumeExport;
  paperSize: PaperSize;
  fileName: string;
}

async function createResumePdfBlob(options: DownloadResumePdfOptions) {
  return pdf(<PDFResumeDocument data={options.data} paperSize={options.paperSize} />).toBlob();
}

export async function downloadResumePdf(options: DownloadResumePdfOptions) {
  const blob = await createResumePdfBlob(options);
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = options.fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export async function openResumePdfPreview(options: DownloadResumePdfOptions) {
  const blob = await createResumePdfBlob(options);
  const url = URL.createObjectURL(blob);
  const previewWindow = window.open(url, '_blank');

  if (previewWindow) {
    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 60000);
    return { openedPreview: true };
  }

  const link = document.createElement('a');
  link.href = url;
  link.download = options.fileName;
  link.click();
  URL.revokeObjectURL(url);
  return { openedPreview: false };
}
