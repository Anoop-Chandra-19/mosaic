import type { ReactNode } from 'react';
import type { PaperSize } from '@/types/paper';
import { PAGE_MARGINS_PT, PAPER_DIMENSIONS_PT } from './pageGeometry';

interface PreviewPageProps {
  children: ReactNode;
  paperSize: PaperSize;
  /** Which sheet this is, when the resume runs to more than one. */
  pageNumber?: number;
  pageCount?: number;
  /** The resume runs on past `pageCount`, which is as far as the preview goes. */
  pageCountIsPartial?: boolean;
}

/**
 * A fixed-size sheet, in points rendered as pixels. Deliberately not responsive:
 * the parent scales it visually so line wraps stay identical to the exported PDF.
 * Reflowing it to fit the panel is what would break that.
 */
export function PreviewPage({
  children,
  paperSize,
  pageNumber,
  pageCount,
  pageCountIsPartial,
}: PreviewPageProps) {
  const paper = PAPER_DIMENSIONS_PT[paperSize];

  return (
    // The number sits below the sheet, so it hangs outside the paper's own clipping.
    <div className="relative" style={{ width: `${paper.width}px` }}>
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
      {pageNumber !== undefined && (
        <span
          data-preview-page-number
          className="absolute top-full right-0 mt-1 font-mono text-[0.6rem] tracking-wide text-ink-faint"
        >
          {pageNumber} / {pageCount}
          {pageCountIsPartial && '+'}
        </span>
      )}
    </div>
  );
}
