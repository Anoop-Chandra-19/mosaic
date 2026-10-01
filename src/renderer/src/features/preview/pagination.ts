import { formatEntryHeading } from '@shared/resume/entryHeading';
import type { ResumeEntry, ResumeSection, SectionLayout } from '@shared/types/resume';
import { HEADLESS_LAYOUT } from '@/lib/resume/headlessLayout';
import type { PreviewBullet, PreviewEntry, PreviewRenderableSection } from './PreviewSection';

export interface PaginationMeasurements {
  headerHeight: number;
  sectionTitleHeights: Record<string, number>;
  entryHeights: Record<string, number>;
  entryHeadingHeights: Record<string, number>;
  bulletHeights: Record<string, number>;
  /** Where each drawn line starts in a text-only entry (by entry key) or a bullet (by id). */
  lineStarts: Record<string, number[]>;
}

interface PageLayout {
  sections: PreviewRenderableSection[];
  usedHeight: number;
}

type PaginatedBullet = PreviewBullet & { _lineStarts?: number[] };

type PaginatedEntry = PreviewEntry & {
  _height?: number;
  _sourceKey?: string;
  /** The line starts of what is left of a text-only entry carried onto a new page. */
  _lineStarts?: number[];
};

// The Headless format puts everything on a single 18pt leading grid: one blank
// line above each section header, and no gaps anywhere else. Spacing between
// bullets and between entries comes from the leading itself, so the gaps below
// are zero on purpose -- adding any pushes the page off the grid.
const SECTION_TOP_PADDING_PX = HEADLESS_LAYOUT.bodyLeading;
const SECTION_CONTENT_TOP_PADDING_PX = 0;
const TEXT_ONLY_SECTION_CONTENT_TOP_PADDING_PX = 0;
const ENTRY_GAP_PX = 0;
const TEXT_ONLY_ENTRY_GAP_PX = 0;
const ENTRY_INTERNAL_GAP_PX = HEADLESS_LAYOUT.entryHeadingMarginBottom;
const BULLET_GAP_PX = 0;

// Estimates are used before DOM measurements exist and when splitting overflow
// text. Arial averages close to half its point size per character, so a 468pt
// column fits ~89 characters and a bullet's 432pt column fits ~82.
const TEXT_CHARS_PER_LINE = 89;
const BULLET_CHARS_PER_LINE = 82;
const BODY_LINE_HEIGHT_PX = HEADLESS_LAYOUT.bodyLeading;
const HEADING_LINE_HEIGHT_PX = HEADLESS_LAYOUT.bodyLeading;
/** Lines a paragraph keeps on each side of a page break: react-pdf's and Word's default. */
const MIN_LINES_AT_BREAK = 2;

function estimateTextHeight(
  text: string,
  lineHeight = BODY_LINE_HEIGHT_PX,
  charsPerLine = TEXT_CHARS_PER_LINE
) {
  const lines = Math.max(1, Math.ceil(text.trim().length / charsPerLine));
  return lines * lineHeight;
}

function normalizeEntry(entry: ResumeEntry, layout: SectionLayout): PaginatedEntry | null {
  if (!entry.selected) return null;

  if (layout === 'lines') {
    const text = (entry.text ?? '').trim();
    if (!text) return null;
    return { id: entry.id, text, bullets: [], _sourceKey: entry.id };
  }

  const heading = formatEntryHeading(entry);
  const dates = (entry.dates ?? '').trim();
  const bullets = entry.bullets
    .filter((bullet) => bullet.selected)
    .map((bullet) => ({ id: bullet.id, text: bullet.text.trim() }))
    .filter((bullet) => bullet.text);

  if (!heading && !dates && bullets.length === 0) return null;

  return {
    id: entry.id,
    heading,
    dates,
    bullets,
    _sourceKey: entry.id,
  };
}

export function normalizeSections(sections: ResumeSection[]): PreviewRenderableSection[] {
  return sections
    .filter((section) => !section.hidden)
    .sort((a, b) => a.order - b.order)
    .map((section) => ({
      id: section.id,
      layout: section.layout,
      label: section.label,
      entries: section.items
        .map((entry) => normalizeEntry(entry, section.layout))
        .filter((entry): entry is PaginatedEntry => entry !== null),
    }))
    .filter((section) => section.entries.length > 0);
}

function splitTextByChars(text: string, maxChars: number) {
  // Prefer word boundaries so continued text does not split in the middle of words.
  const normalized = text.trim();
  if (normalized.length <= maxChars) return [normalized, ''] as const;

  const breakpoint = normalized.lastIndexOf(' ', maxChars);
  const splitAt = breakpoint > Math.floor(maxChars * 0.6) ? breakpoint : maxChars;
  return [normalized.slice(0, splitAt).trim(), normalized.slice(splitAt).trim()] as const;
}

function estimateBulletHeight(text: string) {
  return estimateTextHeight(text, BODY_LINE_HEIGHT_PX, BULLET_CHARS_PER_LINE);
}

function getBulletHeight(bullet: PaginatedBullet, measurements: PaginationMeasurements) {
  if (bullet._lineStarts) return bullet._lineStarts.length * BODY_LINE_HEIGHT_PX;
  return measurements.bulletHeights[bullet.id] ?? estimateBulletHeight(bullet.text);
}

function countLinesBeforeBreak(lineCount: number, availableHeight: number) {
  const kept = Math.min(
    Math.floor(availableHeight / BODY_LINE_HEIGHT_PX),
    lineCount - MIN_LINES_AT_BREAK
  );
  return kept < MIN_LINES_AT_BREAK ? 0 : kept;
}

function splitBulletByLines(
  bullet: PaginatedBullet,
  availableHeight: number,
  measurements: PaginationMeasurements,
  continuationIndex: number
): { first: PaginatedBullet; rest: PaginatedBullet } | null {
  const lineStarts = bullet._lineStarts ?? measurements.lineStarts[bullet.id];
  if (!lineStarts) return null;
  const kept = countLinesBeforeBreak(lineStarts.length, availableHeight);
  if (!kept) return null;

  const at = lineStarts[kept];
  return {
    first: {
      ...bullet,
      text: bullet.text.slice(0, at).trimEnd(),
      _lineStarts: lineStarts.slice(0, kept),
    },
    rest: {
      ...bullet,
      id: `${bullet.id}-cont-${continuationIndex}`,
      text: bullet.text.slice(at),
      isContinued: true,
      _lineStarts: lineStarts.slice(kept).map((start) => start - at),
    },
  };
}

function getEntryHeight(
  section: PreviewRenderableSection,
  entry: PaginatedEntry,
  measurements: PaginationMeasurements
) {
  if (entry._height) return entry._height;

  const sourceKey = entry._sourceKey ?? entry.id;
  const entryKey = `${section.id}::${sourceKey}`;
  // A continued entry holds only some of the bullets the measured entry did.
  const isWholeEntry = sourceKey === entry.id;
  const measuredHeight = isWholeEntry ? measurements.entryHeights[entryKey] : undefined;
  if (measuredHeight) return measuredHeight;

  if (section.layout === 'lines') {
    return estimateTextHeight(entry.text ?? '', BODY_LINE_HEIGHT_PX, TEXT_CHARS_PER_LINE);
  }

  const headingHeight =
    entry.heading || entry.dates
      ? (measurements.entryHeadingHeights[entryKey] ?? HEADING_LINE_HEIGHT_PX)
      : 0;
  const bulletsHeight = entry.bullets.reduce(
    (sum, bullet) => sum + getBulletHeight(bullet, measurements),
    0
  );
  const bulletGaps = Math.max(0, entry.bullets.length - 1) * BULLET_GAP_PX;
  const internalGap = headingHeight > 0 && entry.bullets.length > 0 ? ENTRY_INTERNAL_GAP_PX : 0;
  return headingHeight + bulletsHeight + bulletGaps + internalGap;
}

function splitEntryByAvailableHeight(
  section: PreviewRenderableSection,
  entry: PaginatedEntry,
  availableHeight: number,
  measurements: PaginationMeasurements,
  continuationIndex: number,
  pageContentHeight: number
): { first: PaginatedEntry; rest: PaginatedEntry | null } | null {
  if (availableHeight <= 18) return null;

  if (section.layout === 'lines') {
    const text = entry.text ?? '';
    const lineStarts =
      entry._lineStarts ??
      measurements.lineStarts[`${section.id}::${entry._sourceKey ?? entry.id}`];

    if (lineStarts) {
      if (lineStarts.length * BODY_LINE_HEIGHT_PX <= availableHeight) {
        return {
          first: {
            ...entry,
            id: `${entry.id}-cont-${continuationIndex}`,
            _height: lineStarts.length * BODY_LINE_HEIGHT_PX,
          },
          rest: null,
        };
      }
      const kept = countLinesBeforeBreak(lineStarts.length, availableHeight);
      if (!kept) return null;

      const at = lineStarts[kept];
      return {
        first: {
          ...entry,
          id: `${entry.id}-cont-${continuationIndex}`,
          text: text.slice(0, at).trimEnd(),
          _height: kept * BODY_LINE_HEIGHT_PX,
          _lineStarts: undefined,
        },
        rest: {
          ...entry,
          id: `${entry.id}-cont-${continuationIndex + 1}`,
          text: text.slice(at),
          _height: (lineStarts.length - kept) * BODY_LINE_HEIGHT_PX,
          _lineStarts: lineStarts.slice(kept).map((start) => start - at),
        },
      };
    }

    const fullHeight = getEntryHeight(section, entry, measurements);
    const ratio = Math.max(0.25, Math.min(0.9, availableHeight / Math.max(fullHeight, 1)));
    const maxChars = Math.max(100, Math.floor(text.length * ratio));
    const [firstText, restText] = splitTextByChars(text, maxChars);

    if (!firstText) return null;

    return {
      first: {
        ...entry,
        id: `${entry.id}-cont-${continuationIndex}`,
        text: firstText,
        _height: estimateTextHeight(firstText),
      },
      rest: restText
        ? {
            ...entry,
            id: `${entry.id}-cont-${continuationIndex + 1}`,
            text: restText,
            _height: estimateTextHeight(restText),
          }
        : null,
    };
  }

  const entryKey = `${section.id}::${entry._sourceKey ?? entry.id}`;
  const headingHeight =
    entry.heading || entry.dates
      ? (measurements.entryHeadingHeights[entryKey] ?? HEADING_LINE_HEIGHT_PX)
      : 0;
  const bulletHeights = entry.bullets.map((bullet) => getBulletHeight(bullet, measurements));

  const requiresHeadingGap = headingHeight > 0 && bulletHeights.length > 0;
  let used = headingHeight + (requiresHeadingGap ? ENTRY_INTERNAL_GAP_PX : 0);

  if (availableHeight <= used + 8) return null;

  const keptBullets: PaginatedBullet[] = [];
  let restBullets: PaginatedBullet[] = [];

  for (let i = 0; i < bulletHeights.length; i += 1) {
    const bulletGap = keptBullets.length > 0 ? BULLET_GAP_PX : 0;
    const next = used + bulletGap + bulletHeights[i];
    if (next <= availableHeight) {
      used = next;
      keptBullets.push(entry.bullets[i]);
      continue;
    }
    restBullets = entry.bullets.slice(i);
    // A bullet moves on whole, as in both exports, unless no page could hold it.
    const parts =
      bulletHeights[i] > pageContentHeight
        ? splitBulletByLines(
            entry.bullets[i],
            availableHeight - used - bulletGap,
            measurements,
            continuationIndex
          )
        : null;
    if (parts) {
      used += bulletGap + getBulletHeight(parts.first, measurements);
      keptBullets.push(parts.first);
      restBullets[0] = parts.rest;
    }
    break;
  }

  // A heading never ends a page without a bullet, or a bullet's first lines, under it.
  if (keptBullets.length === 0) return null;

  return {
    first: {
      ...entry,
      id: `${entry.id}-cont-${continuationIndex}`,
      bullets: keptBullets,
      _height: used,
    },
    rest: restBullets.length
      ? {
          ...entry,
          // The exports carry on with the next bullet, not the heading again.
          heading: undefined,
          dates: undefined,
          id: `${entry.id}-cont-${continuationIndex + 1}`,
          bullets: restBullets,
        }
      : null,
  };
}

// The header prints on the first page only, as in the PDF; later pages start at the margin.
function createEmptyPage(pageIndex: number, measurements: PaginationMeasurements): PageLayout {
  return { sections: [], usedHeight: pageIndex === 0 ? measurements.headerHeight : 0 };
}

/**
 * How many pages the preview draws. A resume is one or two; a few more happen while an
 * import is being sorted out. Past this, laying out pages nobody will send only costs time,
 * so the preview stops and says so.
 */
export const MAX_PREVIEW_PAGES = 10;

export function paginateSections(
  sections: PreviewRenderableSection[],
  measurements: PaginationMeasurements,
  pageContentHeight: number,
  /** Stop once this many pages are laid out. */
  maxPages = MAX_PREVIEW_PAGES
): PreviewRenderableSection[][] {
  const pages: PageLayout[] = [createEmptyPage(0, measurements)];
  let continuationIndex = 0;

  const ensureSection = (
    page: PageLayout,
    section: PreviewRenderableSection,
    isContinued: boolean
  ) => {
    const existing = page.sections.find((item) => item.id === section.id);
    if (existing) return existing;

    const next: PreviewRenderableSection = {
      id: section.id,
      layout: section.layout,
      label: section.label,
      entries: [],
      ...(isContinued && { isContinued }),
    };
    page.sections.push(next);
    return next;
  };

  for (const section of sections) {
    const queue = [...(section.entries as PaginatedEntry[])];
    let isStarted = false;

    while (queue.length > 0) {
      const candidate = queue.shift();
      if (!candidate) break;

      let page = pages[pages.length - 1];
      const pageSection = page.sections.find((item) => item.id === section.id);
      const sectionTitleHeight =
        measurements.sectionTitleHeights[section.id] ?? HEADLESS_LAYOUT.bodyLeading;
      const sectionBodyTopPadding =
        section.layout === 'lines'
          ? TEXT_ONLY_SECTION_CONTENT_TOP_PADDING_PX
          : SECTION_CONTENT_TOP_PADDING_PX;
      // A section carried onto a new page picks up there with no title, and one that opens a
      // page has no blank line above it: the page's top margin is enough, as in Word.
      const openCostAt = (target: PageLayout) =>
        isStarted
          ? 0
          : (target === pages[0] || target.usedHeight > 0 ? SECTION_TOP_PADDING_PX : 0) +
            sectionTitleHeight +
            sectionBodyTopPadding;
      const sectionOpenCost = pageSection ? 0 : openCostAt(page);
      const entryGapPx = section.layout === 'lines' ? TEXT_ONLY_ENTRY_GAP_PX : ENTRY_GAP_PX;
      const entryGap = pageSection && pageSection.entries.length > 0 ? entryGapPx : 0;
      const candidateHeight = getEntryHeight(section, candidate, measurements);
      const candidateCost = sectionOpenCost + entryGap + candidateHeight;

      if (page.usedHeight + candidateCost <= pageContentHeight) {
        ensureSection(page, section, isStarted).entries.push(candidate);
        isStarted = true;
        page.usedHeight += candidateCost;
        continue;
      }

      const remainingHeight = pageContentHeight - page.usedHeight - sectionOpenCost - entryGap;
      const split = splitEntryByAvailableHeight(
        section,
        candidate,
        remainingHeight,
        measurements,
        continuationIndex,
        pageContentHeight
      );

      if (split?.first) {
        continuationIndex += 2;
        ensureSection(page, section, isStarted).entries.push(split.first);
        isStarted = true;
        const splitHeight = getEntryHeight(section, split.first, measurements);
        page.usedHeight += sectionOpenCost + entryGap + splitHeight;

        if (split.rest) {
          queue.unshift(split.rest);
          pages.push(createEmptyPage(pages.length, measurements));
        }

        continue;
      }

      pages.push(createEmptyPage(pages.length, measurements));
      page = pages[pages.length - 1];

      const freshSectionCost = openCostAt(page);
      const freshAvailable = pageContentHeight - page.usedHeight - freshSectionCost;
      const forcedSplit = splitEntryByAvailableHeight(
        section,
        candidate,
        freshAvailable,
        measurements,
        continuationIndex,
        pageContentHeight
      );

      // Nothing to split it at — an entry with no bullets — so it goes on the new page whole.
      if (!forcedSplit?.first) {
        ensureSection(page, section, isStarted).entries.push(candidate);
        isStarted = true;
        page.usedHeight += freshSectionCost + candidateHeight;
        continue;
      }

      continuationIndex += 2;
      ensureSection(page, section, isStarted).entries.push(forcedSplit.first);
      isStarted = true;
      const forcedHeight = getEntryHeight(section, forcedSplit.first, measurements);
      page.usedHeight += freshSectionCost + forcedHeight;

      if (forcedSplit.rest) {
        queue.unshift(forcedSplit.rest);
      }
    }

    if (pages.length >= maxPages) break;
  }

  const normalizedPages = pages
    .map((page) => ({
      ...page,
      sections: page.sections.filter((section) => section.entries.length > 0),
    }))
    // The first page stays, with only the header if its sections moved on: the header is
    // drawn on the first page, and the rest were laid out without it.
    .filter((page, index) => index === 0 || page.sections.length > 0)
    .slice(0, maxPages)
    .map((page) => page.sections);

  return normalizedPages.length > 0 ? normalizedPages : [[]];
}

export function createFallbackMeasurements(
  sections: PreviewRenderableSection[]
): PaginationMeasurements {
  const sectionTitleHeights: Record<string, number> = {};
  const entryHeights: Record<string, number> = {};

  for (const section of sections) {
    sectionTitleHeights[section.id] = HEADLESS_LAYOUT.bodyLeading;

    for (const entry of section.entries as PaginatedEntry[]) {
      const key = `${section.id}::${entry._sourceKey ?? entry.id}`;
      entryHeights[key] =
        section.layout === 'lines'
          ? estimateTextHeight(entry.text ?? '', BODY_LINE_HEIGHT_PX)
          : HEADING_LINE_HEIGHT_PX +
            entry.bullets.reduce((sum, bullet) => sum + estimateBulletHeight(bullet.text), 0);
    }
  }

  return {
    // nameMarginTop + name line + nameMarginBottom + two contact lines + gap.
    headerHeight: 89,
    sectionTitleHeights,
    entryHeights,
    entryHeadingHeights: {},
    bulletHeights: {},
    lineStarts: {},
  };
}
