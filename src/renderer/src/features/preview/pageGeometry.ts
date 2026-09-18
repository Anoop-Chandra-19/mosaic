import type { PaperSize } from '@/types/paper';
import { HEADLESS_LAYOUT, PAPER_SIZE_PT, getPageContentSizePt } from '@/lib/resume/headlessLayout';

/**
 * The preview works in points rendered 1:1 as CSS pixels, the same units the
 * PDF export uses, so both lay text out on an identical grid. The page is then
 * scaled visually to fit the panel rather than reflowed.
 */
export const PAPER_DIMENSIONS_PT = PAPER_SIZE_PT;

export const PAGE_MARGINS_PT = {
  top: HEADLESS_LAYOUT.marginTop,
  bottom: HEADLESS_LAYOUT.marginBottom,
  side: HEADLESS_LAYOUT.marginSide,
};

export function getPageContentSize(paperSize: PaperSize) {
  return getPageContentSizePt(paperSize);
}
