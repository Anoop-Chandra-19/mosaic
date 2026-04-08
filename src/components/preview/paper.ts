import type { PaperSize } from '@/types/ui';

export const PAGE_MARGIN_MM = 12;

export const PAPER_DIMENSIONS_MM: Record<PaperSize, { width: number; height: number }> = {
  a4: { width: 210, height: 297 },
  letter: { width: 215.9, height: 279.4 },
};
