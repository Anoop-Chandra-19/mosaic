import type { ReactNode } from 'react';
import type { PaperSize } from '@/types/ui';
import { PAGE_MARGIN_MM, PAPER_DIMENSIONS_MM } from './paper';

interface PreviewPageProps {
  children: ReactNode;
  paperSize: PaperSize;
}

function getPagePadding(paperSize: PaperSize) {
  const paper = PAPER_DIMENSIONS_MM[paperSize];
  return {
    horizontal: `${(PAGE_MARGIN_MM / paper.width) * 100}%`,
    vertical: `${(PAGE_MARGIN_MM / paper.height) * 100}%`,
  };
}

export function PreviewPage({ children, paperSize }: PreviewPageProps) {
  const paper = PAPER_DIMENSIONS_MM[paperSize];
  const padding = getPagePadding(paperSize);

  return (
    <article
      className="mx-auto w-full max-w-[44rem] overflow-hidden rounded-sm border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:shadow-zinc-900"
      style={{ aspectRatio: `${paper.width} / ${paper.height}` }}
    >
      <div
        className="h-full text-zinc-900"
        data-preview-page-content
        style={{ paddingInline: padding.horizontal, paddingBlock: padding.vertical }}
      >
        {children}
      </div>
    </article>
  );
}
