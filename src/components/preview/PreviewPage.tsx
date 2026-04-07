import type { ReactNode } from 'react';

interface PreviewPageProps {
  children: ReactNode;
}

export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;
export const PAGE_MARGIN_MM = 12;

const horizontalPaddingPercent = `${(PAGE_MARGIN_MM / A4_WIDTH_MM) * 100}%`;
const verticalPaddingPercent = `${(PAGE_MARGIN_MM / A4_HEIGHT_MM) * 100}%`;

export function PreviewPage({ children }: PreviewPageProps) {
  return (
    <article
      className="mx-auto w-full max-w-[44rem] overflow-hidden rounded-sm border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:shadow-zinc-900"
      style={{ aspectRatio: `${A4_WIDTH_MM} / ${A4_HEIGHT_MM}` }}
    >
      <div
        className="h-full text-zinc-900"
        data-preview-page-content
        style={{ paddingInline: horizontalPaddingPercent, paddingBlock: verticalPaddingPercent }}
      >
        {children}
      </div>
    </article>
  );
}
