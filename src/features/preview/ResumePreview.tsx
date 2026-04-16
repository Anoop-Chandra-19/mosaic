import { useEffect, useMemo, useRef, useState } from 'react';
import { useResumeStore } from '@/stores/resumeStore';
import type { PaperSize } from '@/types/ui';
import type { ResumeEntry, ResumeSection, SectionType } from '@/types/resume';
import { PreviewHeader } from './PreviewHeader';
import { PreviewPage } from './PreviewPage';
import { PreviewSection, type PreviewEntry, type PreviewRenderableSection } from './PreviewSection';
import { PAGE_MARGIN_MM, PAPER_DIMENSIONS_MM } from './paper';

interface ResumePreviewProps {
  paperSize: PaperSize;
  onMetaChange: (meta: ResumePreviewMeta) => void;
}

export interface ResumePreviewMeta {
  visiblePages: number;
  totalPages: number;
  hasOverflowBeyondTwo: boolean;
}

interface PaginationMeasurements {
  headerHeight: number;
  continuationHeaderHeight: number;
  sectionTitleHeights: Record<string, number>;
  entryHeights: Record<string, number>;
  entryHeadingHeights: Record<string, number>;
  bulletHeights: Record<string, number[]>;
}

interface PageLayout {
  sections: PreviewRenderableSection[];
  usedHeight: number;
}

type PaginatedEntry = PreviewEntry & {
  _height?: number;
  _sourceKey?: string;
};

const TEXT_ONLY_TYPES = new Set<SectionType>(['summary', 'skills']);
const PX_PER_INCH = 96;
const MM_PER_INCH = 25.4;
const SECTION_TOP_PADDING_PX = 10;
const SECTION_CONTENT_TOP_PADDING_PX = 4.8;
const TEXT_ONLY_SECTION_CONTENT_TOP_PADDING_PX = 2.4;
const ENTRY_GAP_PX = 6;
const TEXT_ONLY_ENTRY_GAP_PX = 1.6;
const ENTRY_INTERNAL_GAP_PX = 1.8;
const BULLET_GAP_PX = 1.6;
const TEXT_CHARS_PER_LINE = 88;
const MEASUREMENT_THROTTLE_MS = 100;
const BODY_LINE_HEIGHT_PX = 17;
const HEADING_LINE_HEIGHT_PX = 15.8;

function mmToPx(mm: number) {
  return (mm / MM_PER_INCH) * PX_PER_INCH;
}

function getDefaultPageContentSize(paperSize: PaperSize) {
  const paper = PAPER_DIMENSIONS_MM[paperSize];
  return {
    width: mmToPx(paper.width - PAGE_MARGIN_MM * 2),
    height: mmToPx(paper.height - PAGE_MARGIN_MM * 2),
  };
}

function estimateTextHeight(
  text: string,
  lineHeight = BODY_LINE_HEIGHT_PX,
  charsPerLine = TEXT_CHARS_PER_LINE
) {
  const lines = Math.max(1, Math.ceil(text.trim().length / charsPerLine));
  return lines * lineHeight;
}

function normalizeEntry(entry: ResumeEntry, sectionType: SectionType): PaginatedEntry | null {
  if (!entry.selected) return null;

  if (TEXT_ONLY_TYPES.has(sectionType)) {
    const text = (entry.text ?? '').trim();
    if (!text) return null;
    return { id: entry.id, text, bullets: [], _sourceKey: entry.id };
  }

  const title = (entry.title ?? '').trim();
  const subtitle = (entry.subtitle ?? '').trim();
  const bullets = entry.bullets
    .filter((bullet) => bullet.selected)
    .map((bullet) => bullet.text.trim())
    .filter(Boolean);

  if (!title && !subtitle && bullets.length === 0) return null;

  return {
    id: entry.id,
    title,
    subtitle,
    bullets,
    _sourceKey: entry.id,
  };
}

function normalizeSections(sections: ResumeSection[]): PreviewRenderableSection[] {
  return sections
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((section) => ({
      id: section.id,
      type: section.type,
      label: section.label,
      entries: section.items
        .map((entry) => normalizeEntry(entry, section.type))
        .filter((entry): entry is PaginatedEntry => entry !== null),
    }))
    .filter((section) => section.entries.length > 0);
}

function splitTextByChars(text: string, maxChars: number) {
  const normalized = text.trim();
  if (normalized.length <= maxChars) return [normalized, ''] as const;

  const breakpoint = normalized.lastIndexOf(' ', maxChars);
  const splitAt = breakpoint > Math.floor(maxChars * 0.6) ? breakpoint : maxChars;
  return [normalized.slice(0, splitAt).trim(), normalized.slice(splitAt).trim()] as const;
}

function getEntryHeight(
  section: PreviewRenderableSection,
  entry: PaginatedEntry,
  measurements: PaginationMeasurements
) {
  if (entry._height) return entry._height;

  const entryKey = `${section.id}::${entry._sourceKey ?? entry.id}`;
  const measuredHeight = measurements.entryHeights[entryKey];
  if (measuredHeight) return measuredHeight;

  if (TEXT_ONLY_TYPES.has(section.type)) {
    return estimateTextHeight(entry.text ?? '', BODY_LINE_HEIGHT_PX, TEXT_CHARS_PER_LINE);
  }

  const headingHeight = entry.title || entry.subtitle ? HEADING_LINE_HEIGHT_PX : 0;
  const bulletsHeight = entry.bullets.reduce(
    (sum, bullet) => sum + estimateTextHeight(bullet, BODY_LINE_HEIGHT_PX, 92),
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
  continuationIndex: number
): { first: PaginatedEntry; rest: PaginatedEntry | null } | null {
  if (availableHeight <= 18) return null;

  if (TEXT_ONLY_TYPES.has(section.type)) {
    const text = entry.text ?? '';
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
    measurements.entryHeadingHeights[entryKey] ??
    (entry.title || entry.subtitle ? HEADING_LINE_HEIGHT_PX : 0);
  const bulletHeights =
    measurements.bulletHeights[entryKey] ??
    entry.bullets.map((bullet) => estimateTextHeight(bullet, BODY_LINE_HEIGHT_PX, 92));

  const requiresHeadingGap = headingHeight > 0 && bulletHeights.length > 0;
  let used = headingHeight + (requiresHeadingGap ? ENTRY_INTERNAL_GAP_PX : 0);

  if (availableHeight <= used + 8) return null;

  const keptBullets: string[] = [];

  for (let i = 0; i < bulletHeights.length; i += 1) {
    const bulletGap = keptBullets.length > 0 ? BULLET_GAP_PX : 0;
    const next = used + bulletGap + bulletHeights[i];
    if (next > availableHeight) {
      break;
    }
    used = next;
    keptBullets.push(entry.bullets[i]);
  }

  if (keptBullets.length === 0) {
    const firstBullet = entry.bullets[0];
    if (!firstBullet) return null;

    const targetChars = Math.max(80, Math.floor(firstBullet.length * 0.55));
    const [firstBulletPart, restBulletPart] = splitTextByChars(firstBullet, targetChars);
    if (!firstBulletPart) return null;

    const restBullets = [restBulletPart, ...entry.bullets.slice(1)].filter(Boolean) as string[];

    return {
      first: {
        ...entry,
        id: `${entry.id}-cont-${continuationIndex}`,
        bullets: [firstBulletPart],
        _height:
          headingHeight +
          ENTRY_INTERNAL_GAP_PX +
          estimateTextHeight(firstBulletPart, BODY_LINE_HEIGHT_PX, 92),
      },
      rest: restBullets.length
        ? {
            ...entry,
            id: `${entry.id}-cont-${continuationIndex + 1}`,
            bullets: restBullets,
          }
        : null,
    };
  }

  const restBullets = entry.bullets.slice(keptBullets.length);

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
          id: `${entry.id}-cont-${continuationIndex + 1}`,
          bullets: restBullets,
        }
      : null,
  };
}

function getHeaderHeightForPage(pageIndex: number, measurements: PaginationMeasurements) {
  return pageIndex === 0 ? measurements.headerHeight : measurements.continuationHeaderHeight;
}

function createEmptyPage(pageIndex: number, measurements: PaginationMeasurements): PageLayout {
  return { sections: [], usedHeight: getHeaderHeightForPage(pageIndex, measurements) };
}

function paginateSections(
  sections: PreviewRenderableSection[],
  measurements: PaginationMeasurements,
  pageContentHeight: number
): PreviewRenderableSection[][] {
  const pages: PageLayout[] = [createEmptyPage(0, measurements)];
  let continuationIndex = 0;

  const ensureSection = (page: PageLayout, section: PreviewRenderableSection) => {
    const existing = page.sections.find((item) => item.id === section.id);
    if (existing) return existing;

    const next: PreviewRenderableSection = {
      id: section.id,
      type: section.type,
      label: section.label,
      entries: [],
    };
    page.sections.push(next);
    return next;
  };

  for (const section of sections) {
    const queue = [...(section.entries as PaginatedEntry[])];

    while (queue.length > 0) {
      const candidate = queue.shift();
      if (!candidate) break;

      let page = pages[pages.length - 1];
      const pageSection = page.sections.find((item) => item.id === section.id);
      const sectionTitleHeight = measurements.sectionTitleHeights[section.id] ?? 22;
      const sectionBodyTopPadding = TEXT_ONLY_TYPES.has(section.type)
        ? TEXT_ONLY_SECTION_CONTENT_TOP_PADDING_PX
        : SECTION_CONTENT_TOP_PADDING_PX;
      const sectionOpenCost = pageSection
        ? 0
        : SECTION_TOP_PADDING_PX + sectionTitleHeight + sectionBodyTopPadding;
      const entryGapPx = TEXT_ONLY_TYPES.has(section.type) ? TEXT_ONLY_ENTRY_GAP_PX : ENTRY_GAP_PX;
      const entryGap = pageSection && pageSection.entries.length > 0 ? entryGapPx : 0;
      const candidateHeight = getEntryHeight(section, candidate, measurements);
      const candidateCost = sectionOpenCost + entryGap + candidateHeight;

      if (page.usedHeight + candidateCost <= pageContentHeight) {
        const ensuredSection = ensureSection(page, section);
        ensuredSection.entries.push(candidate);
        page.usedHeight += candidateCost;
        continue;
      }

      const remainingHeight = pageContentHeight - page.usedHeight - sectionOpenCost - entryGap;
      const split = splitEntryByAvailableHeight(
        section,
        candidate,
        remainingHeight,
        measurements,
        continuationIndex
      );

      if (split?.first) {
        continuationIndex += 2;
        const ensuredSection = ensureSection(page, section);
        const splitHeight = getEntryHeight(section, split.first, measurements);
        ensuredSection.entries.push(split.first);
        page.usedHeight += sectionOpenCost + entryGap + splitHeight;

        if (split.rest) {
          queue.unshift(split.rest);
          pages.push(createEmptyPage(pages.length, measurements));
        }

        continue;
      }

      pages.push(createEmptyPage(pages.length, measurements));
      page = pages[pages.length - 1];

      const freshSectionCost = SECTION_TOP_PADDING_PX + sectionTitleHeight + sectionBodyTopPadding;
      const freshAvailable = pageContentHeight - page.usedHeight - freshSectionCost;
      const forcedSplit = splitEntryByAvailableHeight(
        section,
        candidate,
        freshAvailable,
        measurements,
        continuationIndex
      );

      if (!forcedSplit?.first) {
        continue;
      }

      continuationIndex += 2;
      const ensuredSection = ensureSection(page, section);
      const forcedHeight = getEntryHeight(section, forcedSplit.first, measurements);
      ensuredSection.entries.push(forcedSplit.first);
      page.usedHeight += freshSectionCost + forcedHeight;

      if (forcedSplit.rest) {
        queue.unshift(forcedSplit.rest);
      }
    }

    if (pages.length >= 3) {
      break;
    }
  }

  const normalizedPages = pages
    .map((page) => ({
      ...page,
      sections: page.sections.filter((section) => section.entries.length > 0),
    }))
    .filter((page) => page.sections.length > 0)
    .slice(0, 3)
    .map((page) => page.sections);

  return normalizedPages.length > 0 ? normalizedPages : [[]];
}

function createFallbackMeasurements(sections: PreviewRenderableSection[]): PaginationMeasurements {
  const sectionTitleHeights: Record<string, number> = {};
  const entryHeights: Record<string, number> = {};

  for (const section of sections) {
    sectionTitleHeights[section.id] = 22;

    for (const entry of section.entries as PaginatedEntry[]) {
      const key = `${section.id}::${entry._sourceKey ?? entry.id}`;
      entryHeights[key] = TEXT_ONLY_TYPES.has(section.type)
        ? estimateTextHeight(entry.text ?? '', BODY_LINE_HEIGHT_PX)
        : HEADING_LINE_HEIGHT_PX +
          entry.bullets.reduce(
            (sum, bullet) => sum + estimateTextHeight(bullet, BODY_LINE_HEIGHT_PX, 92),
            0
          );
    }
  }

  return {
    headerHeight: 110,
    continuationHeaderHeight: 40,
    sectionTitleHeights,
    entryHeights,
    entryHeadingHeights: {},
    bulletHeights: {},
  };
}

export function ResumePreview({ paperSize, onMetaChange }: ResumePreviewProps) {
  const contact = useResumeStore((s) => s.contact);
  const sections = useResumeStore((s) => s.sections);
  const measureRootRef = useRef<HTMLDivElement | null>(null);
  const visiblePageRootRef = useRef<HTMLDivElement | null>(null);
  const [throttledSections, setThrottledSections] = useState<PreviewRenderableSection[]>([]);
  const [measurements, setMeasurements] = useState<PaginationMeasurements | null>(null);
  const [pageContentSize, setPageContentSize] = useState(() =>
    getDefaultPageContentSize(paperSize)
  );

  const normalizedSections = useMemo(() => normalizeSections(sections), [sections]);

  useEffect(() => {
    setPageContentSize(getDefaultPageContentSize(paperSize));
  }, [paperSize]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setThrottledSections(normalizedSections);
    }, MEASUREMENT_THROTTLE_MS);

    return () => window.clearTimeout(timer);
  }, [normalizedSections]);

  useEffect(() => {
    if (!measureRootRef.current) return;

    const frame = window.requestAnimationFrame(() => {
      const root = measureRootRef.current;
      if (!root) return;

      const sectionTitleHeights: Record<string, number> = {};
      const entryHeights: Record<string, number> = {};
      const entryHeadingHeights: Record<string, number> = {};
      const bulletHeights: Record<string, number[]> = {};

      const fullHeaderNode = root.querySelector(
        '[data-preview-header-variant="full"]'
      ) as HTMLElement | null;
      const compactHeaderNode = root.querySelector(
        '[data-preview-header-variant="compact"]'
      ) as HTMLElement | null;
      const headerHeight = fullHeaderNode?.getBoundingClientRect().height ?? 110;
      const continuationHeaderHeight = compactHeaderNode?.getBoundingClientRect().height ?? 40;

      root.querySelectorAll<HTMLElement>('[data-preview-section-title-id]').forEach((node) => {
        const sectionId = node.dataset.previewSectionTitleId;
        if (!sectionId) return;
        sectionTitleHeights[sectionId] = node.getBoundingClientRect().height;
      });

      root.querySelectorAll<HTMLElement>('[data-preview-entry-key]').forEach((node) => {
        const entryKey = node.dataset.previewEntryKey;
        if (!entryKey) return;
        entryHeights[entryKey] = node.getBoundingClientRect().height;
      });

      root.querySelectorAll<HTMLElement>('[data-preview-entry-heading-key]').forEach((node) => {
        const entryKey = node.dataset.previewEntryHeadingKey;
        if (!entryKey) return;
        entryHeadingHeights[entryKey] = node.getBoundingClientRect().height;
      });

      root.querySelectorAll<HTMLElement>('[data-preview-bullet-key]').forEach((node) => {
        const entryKey = node.dataset.previewBulletKey;
        if (!entryKey) return;

        if (!bulletHeights[entryKey]) {
          bulletHeights[entryKey] = [];
        }

        bulletHeights[entryKey].push(node.getBoundingClientRect().height);
      });

      setMeasurements({
        headerHeight,
        continuationHeaderHeight,
        sectionTitleHeights,
        entryHeights,
        entryHeadingHeights,
        bulletHeights,
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [contact, throttledSections, pageContentSize.width]);

  useEffect(() => {
    const pageRoot = visiblePageRootRef.current;
    if (!pageRoot) return;

    const contentNode = pageRoot.querySelector('[data-preview-page-content]') as HTMLElement | null;
    if (!contentNode) return;

    const syncSize = () => {
      const rect = contentNode.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const styles = window.getComputedStyle(contentNode);
      const paddingLeft = Number.parseFloat(styles.paddingLeft) || 0;
      const paddingRight = Number.parseFloat(styles.paddingRight) || 0;
      const paddingTop = Number.parseFloat(styles.paddingTop) || 0;
      const paddingBottom = Number.parseFloat(styles.paddingBottom) || 0;

      const usableWidth = Math.max(1, rect.width - paddingLeft - paddingRight);
      const usableHeight = Math.max(1, rect.height - paddingTop - paddingBottom);

      setPageContentSize((prev) => {
        if (
          Math.abs(prev.width - usableWidth) < 0.5 &&
          Math.abs(prev.height - usableHeight) < 0.5
        ) {
          return prev;
        }
        return { width: usableWidth, height: usableHeight };
      });
    };

    syncSize();

    const observer = new ResizeObserver(syncSize);
    observer.observe(contentNode);

    return () => observer.disconnect();
  }, []);

  const activeSections = throttledSections.length > 0 ? throttledSections : normalizedSections;
  const paginationMeasurements = measurements ?? createFallbackMeasurements(activeSections);

  const paginated = useMemo(
    () => paginateSections(activeSections, paginationMeasurements, pageContentSize.height),
    [activeSections, paginationMeasurements, pageContentSize.height]
  );

  const meta = useMemo<ResumePreviewMeta>(() => {
    const totalPages = paginated.length;
    return {
      visiblePages: Math.min(2, totalPages),
      totalPages,
      hasOverflowBeyondTwo: totalPages > 2,
    };
  }, [paginated]);

  useEffect(() => {
    onMetaChange(meta);
  }, [meta, onMetaChange]);

  const visiblePages = Array.from(
    { length: meta.visiblePages },
    (_, index) => paginated[index] ?? []
  );

  return (
    <>
      <div ref={visiblePageRootRef}>
        <div className="space-y-4">
          {visiblePages.map((pageSections, pageIndex) => (
            <PreviewPage key={`preview-page-${pageIndex}`} paperSize={paperSize}>
              <PreviewHeader
                contact={contact}
                variant={pageIndex === 0 ? 'full' : 'compact'}
                pageNumber={pageIndex + 1}
              />
              <div className="space-y-0">
                {pageSections.map((section) => (
                  <PreviewSection key={`${section.id}-${pageIndex}`} section={section} />
                ))}
              </div>
            </PreviewPage>
          ))}
        </div>
      </div>

      <div className="fixed top-0 -left-[99999px] pointer-events-none" aria-hidden>
        <div
          ref={measureRootRef}
          className="text-zinc-900"
          style={{ width: `${pageContentSize.width}px` }}
        >
          <PreviewHeader contact={contact} variant="full" pageNumber={1} />
          <div className="mt-4">
            <PreviewHeader contact={contact} variant="compact" pageNumber={2} />
          </div>
          <div className="space-y-0">
            {activeSections.map((section) => (
              <PreviewSection key={`measure-${section.id}`} section={section} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
