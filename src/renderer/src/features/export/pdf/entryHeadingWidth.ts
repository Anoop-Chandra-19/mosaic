import { getPageContentSizePt, HEADLESS_LAYOUT } from '@/lib/resume/headlessLayout';
import type { PaperSize } from '@/types/paper';
import type { MeasureTextWidth } from './breakLinesLikeWord';

export function getEntryHeadingWidthPt(
  paper: PaperSize,
  dates: string,
  measure: MeasureTextWidth
): number {
  const width = getPageContentSizePt(paper).width;
  const trimmed = dates.trim();
  return trimmed ? width - measure(trimmed) - HEADLESS_LAYOUT.entryHeadingGap : width;
}
