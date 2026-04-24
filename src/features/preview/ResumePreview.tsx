import { useEffect, useMemo, useRef, useState } from 'react';
import { useResumeStore } from '@/stores/resumeStore';
import type { PaperSize } from '@/types/ui';
import { PreviewHeader } from './PreviewHeader';
import { PreviewPage } from './PreviewPage';
import { PreviewSection, type PreviewRenderableSection } from './PreviewSection';
import {
  createFallbackMeasurements,
  normalizeSections,
  paginateSections,
  type PaginationMeasurements,
} from './pagination';
import { PAGE_MARGIN_MM, PAPER_DIMENSIONS_MM } from './paper';

interface ResumePreviewProps {
  paperSize: PaperSize;
  previewZoom?: number;
  onMetaChange: (meta: ResumePreviewMeta) => void;
}

export interface ResumePreviewMeta {
  visiblePages: number;
  totalPages: number;
  hasOverflowBeyondTwo: boolean;
}

const PX_PER_INCH = 96;
const MM_PER_INCH = 25.4;
const MEASUREMENT_THROTTLE_MS = 100;
const PREVIEW_ZOOM_CLASS_NAMES: Record<number, string> = {
  0.75: '[zoom:0.75]',
  0.9: '[zoom:0.9]',
  1: '[zoom:1]',
  1.1: '[zoom:1.1]',
  1.25: '[zoom:1.25]',
  1.5: '[zoom:1.5]',
};

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

export function ResumePreview({ paperSize, previewZoom = 1, onMetaChange }: ResumePreviewProps) {
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
    const frame = window.requestAnimationFrame(() => {
      setPageContentSize(getDefaultPageContentSize(paperSize));
    });

    return () => window.cancelAnimationFrame(frame);
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

      const measuredWidth = rect.width / previewZoom;
      const measuredHeight = rect.height / previewZoom;
      const usableWidth = Math.max(1, measuredWidth - paddingLeft - paddingRight);
      const usableHeight = Math.max(1, measuredHeight - paddingTop - paddingBottom);

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
  }, [previewZoom]);

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
      <div
        ref={visiblePageRootRef}
        className={`origin-top ${PREVIEW_ZOOM_CLASS_NAMES[previewZoom] ?? '[zoom:1]'}`}
      >
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

      <div className="fixed top-0 -left-24999.75 pointer-events-none" aria-hidden>
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
