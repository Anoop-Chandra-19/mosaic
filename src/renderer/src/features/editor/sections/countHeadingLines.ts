import {
  createTextMeasurer,
  findLineStarts,
  type MeasureTextWidth,
} from '@/lib/resume/breakLinesLikeWord';
import { getEntryHeadingWidthPt } from '@/lib/resume/entryHeadingWidth';
import { RESUME_LAYOUT } from '@/lib/resume/resumeLayout';
import type { PaperSize } from '@/types/paper';
import { formatEntryHeading } from '@/lib/resume/entryHeading';
import type { ResumeEntry } from '@shared/types/resume';

let defaultMeasure: MeasureTextWidth | null | undefined;

/** Null where text can't be measured. */
export function countHeadingLines(
  entry: Pick<ResumeEntry, 'title' | 'organization' | 'location' | 'dates'>,
  paper: PaperSize,
  measure = (defaultMeasure ??= createTextMeasurer(RESUME_LAYOUT.bodyFontSize))
): number | null {
  if (!measure) return null;
  const heading = formatEntryHeading(entry);
  if (!heading) return 0;
  const width = getEntryHeadingWidthPt(paper, entry.dates ?? '', measure);
  return findLineStarts(heading, width, measure).length;
}
