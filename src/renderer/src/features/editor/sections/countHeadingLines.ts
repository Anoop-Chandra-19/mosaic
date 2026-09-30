import {
  createTextMeasurer,
  findLineStarts,
  type MeasureTextWidth,
} from '@/features/export/pdf/breakLinesLikeWord';
import { getEntryHeadingWidthPt } from '@/features/export/pdf/entryHeadingWidth';
import { HEADLESS_LAYOUT } from '@/lib/resume/headlessLayout';
import type { PaperSize } from '@/types/paper';
import { formatEntryHeading } from '@shared/resume/entryHeading';
import type { ResumeEntry } from '@shared/types/resume';

let defaultMeasure: MeasureTextWidth | null | undefined;

/** Null where text can't be measured. */
export function countHeadingLines(
  entry: Pick<ResumeEntry, 'title' | 'organization' | 'location' | 'dates'>,
  paper: PaperSize,
  measure = (defaultMeasure ??= createTextMeasurer(HEADLESS_LAYOUT.bodyFontSize))
): number | null {
  if (!measure) return null;
  const heading = formatEntryHeading(entry);
  if (!heading) return 0;
  const width = getEntryHeadingWidthPt(paper, entry.dates ?? '', measure);
  return findLineStarts(heading, width, measure).length;
}
