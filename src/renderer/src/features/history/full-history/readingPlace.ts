/*
 * Where the reader is on a version's page, so stepping to another version can put the same
 * line back at the same height. The line may be gone in the other version, so its entry's
 * and section's headings stand in for it, nearest first.
 */

/** Selectors for the line at the top of the pane and its headings, and its height there. */
export interface ReadingPlace {
  selectors: string[];
  offsetPx: number;
}

/** Below this the pane is at the top of the page, where there is no place to keep. */
const SCROLLED_MIN_PX = 4;

const LINES = [
  '[data-preview-section-title-id]',
  '[data-preview-entry-heading-key]',
  'p[data-preview-entry-key]',
  '[data-preview-bullet-id]',
].join(', ');

function selectLine(line: HTMLElement): string {
  const { previewSectionTitleId, previewEntryHeadingKey, previewEntryKey, previewBulletId } =
    line.dataset;
  if (previewSectionTitleId) {
    return `[data-preview-section-title-id="${CSS.escape(previewSectionTitleId)}"]`;
  }
  if (previewEntryHeadingKey) {
    return `[data-preview-entry-heading-key="${CSS.escape(previewEntryHeadingKey)}"]`;
  }
  if (previewEntryKey) return `p[data-preview-entry-key="${CSS.escape(previewEntryKey)}"]`;
  return `[data-preview-bullet-id="${CSS.escape(previewBulletId ?? '')}"]`;
}

/** The drawn page's lines, in page order: never the preview's offscreen copy. */
function listLines(scroller: HTMLElement): HTMLElement[] {
  return [...scroller.querySelectorAll<HTMLElement>(`[data-preview-stack] :is(${LINES})`)];
}

/** The first line showing at the top of `scroller`, with the headings above it. */
export function findReadingPlace(scroller: HTMLElement): ReadingPlace | null {
  if (scroller.scrollTop < SCROLLED_MIN_PX) return null;
  const top = scroller.getBoundingClientRect().top;
  let entryHeading: string | null = null;
  let sectionTitle: string | null = null;
  for (const line of listLines(scroller)) {
    const box = line.getBoundingClientRect();
    if (box.bottom > top + 2) {
      const selectors = [selectLine(line), entryHeading, sectionTitle];
      return {
        selectors: selectors.filter((selector) => selector !== null),
        offsetPx: box.top - top,
      };
    }
    if (line.matches('[data-preview-section-title-id]')) {
      sectionTitle = selectLine(line);
      entryHeading = null;
    } else if (line.matches('[data-preview-entry-heading-key]')) {
      entryHeading = selectLine(line);
    }
  }
  return null;
}

/** Scrolls so the place's line, or failing that its nearest heading, is where the line was. */
export function restoreReadingPlace(scroller: HTMLElement, place: ReadingPlace): void {
  const top = scroller.getBoundingClientRect().top;
  for (const selector of place.selectors) {
    const line = scroller.querySelector(`[data-preview-stack] ${selector}`);
    if (!line) continue;
    scroller.scrollTop += line.getBoundingClientRect().top - top - place.offsetPx;
    return;
  }
}
