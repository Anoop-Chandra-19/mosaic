import type { ReactNode } from 'react';
import type { PaperSize } from '@/types/paper';
import { HEADLESS_LAYOUT, PAPER_SIZE_PT } from '@/lib/resume/headlessLayout';

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
  const paper = PAPER_SIZE_PT[paperSize];

  return (
    // The number sits below the sheet, so it hangs outside the paper's own clipping.
    <div className="relative" style={{ width: `${paper.width}px` }}>
      <article
        className="overflow-hidden border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:shadow-zinc-900"
        style={{ width: `${paper.width}px`, height: `${paper.height}px` }}
      >
        <div
          // Word doesn't kern body text, and a kerned line can hold a word Word's can't.
          className="h-full font-normal tracking-normal text-black [font-kerning:none]"
          data-preview-page-content
          style={{
            paddingTop: `${HEADLESS_LAYOUT.marginTop}px`,
            paddingBottom: `${HEADLESS_LAYOUT.marginBottom}px`,
            paddingInline: `${HEADLESS_LAYOUT.marginSide}px`,
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
