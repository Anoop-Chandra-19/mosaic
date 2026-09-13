import { getDb } from '@/lib/storage/mosaicDb';
import { flushDraft } from '@/stores/resumeStore';
import type { FileType } from '@/types/files';
import type { ResumeData } from '@/types/resume';
import type { PaperSize } from '@/types/ui';
import { createJsonResumeExport } from './jsonResume';
import { createMarkdownExport } from './markdown';
import { normalizeResumeForExport } from './normalizeResumeExport';
import { renderResumePdf } from './pdf';
import { createPlaintextExport } from './plaintext';

export type ExportFormat = 'pdf' | 'markdown' | 'plaintext' | 'json-resume' | 'mosaic-json';

export interface ExportFormatInfo {
  id: ExportFormat;
  name: string;
  description: string;
  extension: string;
  fileType: FileType;
  /** Text that can go on the clipboard as well as into a file. */
  copyable: boolean;
}

export const EXPORT_FORMATS: ExportFormatInfo[] = [
  {
    id: 'pdf',
    name: 'PDF',
    description: 'Print-exact. Fonts embedded, text selectable and ATS-readable.',
    extension: 'pdf',
    fileType: 'pdf',
    copyable: false,
  },
  {
    id: 'markdown',
    name: 'Markdown',
    description: 'Headings, entries, and bullets as plain text you can diff.',
    extension: 'md',
    fileType: 'markdown',
    copyable: true,
  },
  {
    id: 'plaintext',
    name: 'Plain text',
    description: 'One column, no formatting — for paste-into-a-textarea applications.',
    extension: 'txt',
    fileType: 'text',
    copyable: true,
  },
  {
    id: 'json-resume',
    name: 'JSON Resume',
    description: 'The open jsonresume.org format, for other resume tools.',
    extension: 'json',
    fileType: 'json',
    copyable: true,
  },
  {
    id: 'mosaic-json',
    name: 'Mosaic JSON',
    description: 'The full content model, including hidden bullets and version history.',
    extension: 'json',
    fileType: 'json',
    copyable: true,
  },
];

/** What is being exported: the open draft (with its template), or one version's document. */
export interface ExportSource {
  doc: ResumeData;
  /** The open draft's template. Null for a version, which has no Mosaic JSON export. */
  templateId: string | null;
}

/**
 * The file's content. PDF and the text formats take what is on the page — selected entries
 * and bullets only. Mosaic JSON is the template itself, as a one-template backup that
 * Restore or Import reads back in.
 */
export async function renderExport(
  format: ExportFormat,
  { doc, templateId }: ExportSource,
  paperSize: PaperSize
): Promise<string | Uint8Array> {
  switch (format) {
    case 'pdf':
      return renderResumePdf({ data: normalizeResumeForExport(doc), paperSize });
    case 'markdown':
      return createMarkdownExport(normalizeResumeForExport(doc));
    case 'plaintext':
      return createPlaintextExport(normalizeResumeForExport(doc));
    case 'json-resume':
      return createJsonResumeExport(normalizeResumeForExport(doc));
    case 'mosaic-json': {
      if (templateId === null) throw new Error('Only a template exports as Mosaic JSON');
      // The file should hold the edits still waiting to be saved.
      await flushDraft();
      return JSON.stringify(await getDb().bundle.export([templateId]), null, 2);
    }
  }
}

export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // The async clipboard can refuse (no focus, no permission); the old path rarely does.
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    if (!copied) throw new Error('The clipboard refused the text');
  }
}
