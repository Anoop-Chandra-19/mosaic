import type { PaperSize } from '@/types/ui';

interface PdfFileNameOptions {
  contactName?: string;
  paperSize: PaperSize;
  templateName?: string;
  now?: Date;
}

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  return slug || 'mosaic';
}

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

export function buildPdfFileName(options: PdfFileNameOptions) {
  const baseCandidate = (options.templateName ?? '').trim() || (options.contactName ?? '').trim();
  const base = slugify(baseCandidate || 'mosaic');
  const paper = options.paperSize;
  const date = formatDate(options.now ?? new Date());
  return `${base}-resume-${paper}-${date}.pdf`;
}
