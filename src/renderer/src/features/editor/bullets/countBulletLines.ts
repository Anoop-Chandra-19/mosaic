import {
  createTextMeasurer,
  findLineStarts,
  type MeasureTextWidth,
} from '@/features/export/pdf/breakLinesLikeWord';
import { getPageContentSizePt, HEADLESS_LAYOUT } from '@/lib/resume/headlessLayout';
import type { PaperSize } from '@/types/paper';

/** Where text can't be measured (unit tests). */
const THIRD_LINE_CHARS = 190;

let measure: MeasureTextWidth | null | undefined;

/** Lines on the page, broken as the preview and exports break them. */
export function countBulletLines(text: string, paper: PaperSize): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  measure ??= createTextMeasurer(HEADLESS_LAYOUT.bodyFontSize);
  if (!measure) return trimmed.length > THIRD_LINE_CHARS ? 3 : 1;
  const width = getPageContentSizePt(paper).width - HEADLESS_LAYOUT.bulletTextIndent;
  return findLineStarts(trimmed, width, measure).length;
}
