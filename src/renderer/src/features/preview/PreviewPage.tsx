import type { ReactNode } from 'react';
import type { PaperSize } from '@/types/ui';
import { PAGE_MARGINS_PT, PAPER_DIMENSIONS_PT } from './pageGeometry';

interface PreviewPageProps {
  children: ReactNode;
  paperSize: PaperSize;
}

/**
 * A fixed-size sheet, in points rendered as pixels. Deliberately not responsive:
 * the parent scales it visually so line wraps stay identical to the exported PDF.
 * Reflowing it to fit the panel is what would break that.
 */
export function PreviewPage({ children, paperSize }: PreviewPageProps) {
  const paper = PAPER_DIMENSIONS_PT[paperSize];

  return (
    <article
      className="overflow-hidden border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:shadow-zinc-900"
      style={{ width: `${paper.width}px`, height: `${paper.height}px` }}
    >
      <div
        className="h-full text-black"
        data-preview-page-content
        style={{
          paddingTop: `${PAGE_MARGINS_PT.top}px`,
          paddingBottom: `${PAGE_MARGINS_PT.bottom}px`,
          paddingInline: `${PAGE_MARGINS_PT.side}px`,
        }}
      >
        {children}
      </div>
    </article>
  );
}
