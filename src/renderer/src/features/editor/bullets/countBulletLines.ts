import {
  createTextMeasurer,
  findLineStarts,
  type MeasureTextWidth,
} from '@/lib/resume/breakLinesLikeWord';
import { getPageContentSizePt, RESUME_LAYOUT } from '@/lib/resume/resumeLayout';
import type { PaperSize } from '@/types/paper';

/** About how many characters fill a line, where text can't be measured (unit tests). */
const LINE_CHARS = 95;

let measure: MeasureTextWidth | null | undefined;

/** Lines on the page, broken as the preview and exports break them. */
export function countBulletLines(text: string, paper: PaperSize): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  measure ??= createTextMeasurer(RESUME_LAYOUT.bodyFontSize);
  if (!measure) return Math.ceil(trimmed.length / LINE_CHARS);
  const width = getPageContentSizePt(paper).width - RESUME_LAYOUT.bulletTextIndent;
  return findLineStarts(trimmed, width, measure).length;
}
