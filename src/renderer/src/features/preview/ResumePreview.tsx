import { useEffect, useMemo, useRef, useState } from 'react';
import { useResumeStore } from '@/stores/resumeStore';
import type { ResumeData } from '@shared/types/resume';
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
import { PAPER_DIMENSIONS_PT, getPageContentSize } from './paper';

interface ResumePreviewProps {
  paperSize: PaperSize;
  previewZoom?: number;
  onMetaChange: (meta: ResumePreviewMeta) => void;
  /** A document to show instead of the draft — a version being read before a restore. */
  doc?: ResumeData;
}

export interface ResumePreviewMeta {
  visiblePages: number;
  totalPages: number;
  hasOverflowBeyondTwo: boolean;
}

const MEASUREMENT_THROTTLE_MS = 100;
const PAGE_GAP_PX = 16;

export function ResumePreview({
  paperSize,
  previewZoom = 1,
  onMetaChange,
  doc,
}: ResumePreviewProps) {
  const draftContact = useResumeStore((s) => s.contact);
  const draftSections = useResumeStore((s) => s.sections);
  const contact = doc?.contact ?? draftContact;
  const sections = doc?.sections ?? draftSections;
  const measureRootRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [throttledSections, setThrottledSections] = useState<PreviewRenderableSection[]>([]);
  const [measurements, setMeasurements] = useState<PaginationMeasurements | null>(null);
  const [availableWidth, setAvailableWidth] = useState(0);

  // The sheet is a known fixed size in points, so there is nothing to measure.
  const paper = PAPER_DIMENSIONS_PT[paperSize];
  const pageContentSize = getPageContentSize(paperSize);

  const normalizedSections = useMemo(() => normalizeSections(sections), [sections]);

  useEffect(() => {
    // Avoid re-measuring the resume on every keystroke while the user is typing.
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

      // Measure an offscreen, unpaginated render to drive page splitting accurately.

      const sectionTitleHeights: Record<string, number> = {};
      const entryHeights: Record<string, number> = {};
      const entryHeadingHeights: Record<string, number> = {};
      const bulletHeights: Record<string, number[]> = {};

      const headerNode = root.querySelector<HTMLElement>('[data-preview-header]');
      const headerHeight = headerNode?.getBoundingClientRect().height ?? 110;

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
        sectionTitleHeights,
        entryHeights,
        entryHeadingHeights,
        bulletHeights,
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [contact, throttledSections, pageContentSize.width]);

  // Track only how much room the panel gives us, so a page wider than the panel
  // can be scaled down to fit instead of overflowing.
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const sync = () => setAvailableWidth(node.clientWidth);
    sync();

    const observer = new ResizeObserver(sync);
    observer.observe(node);

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

  // Chrome's PDF viewer model: the page's layout never changes, it is just
  // drawn larger or smaller. transform (not CSS zoom) is what guarantees that,
  // because transform is applied after layout and so cannot re-wrap any text.
  const fitScale = availableWidth > 0 ? Math.min(1, availableWidth / paper.width) : 1;
  const scale = fitScale * previewZoom;
  const scaledHeight =
    (paper.height * visiblePages.length + PAGE_GAP_PX * Math.max(0, visiblePages.length - 1)) *
    scale;

  return (
    <>
      <div ref={containerRef} className="w-full">
        {/* Reserves the post-scale footprint, since transform does not affect
            layout. mx-auto centers it when it fits and falls back to flush left
            (auto margins resolve to zero) once it is wider than the panel. */}
        <div
          className="mx-auto"
          style={{ width: `${paper.width * scale}px`, height: `${scaledHeight}px` }}
        >
          <div
            className="flex flex-col items-start"
            style={{
              gap: `${PAGE_GAP_PX}px`,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
          >
            {visiblePages.map((pageSections, pageIndex) => (
              <PreviewPage key={`preview-page-${pageIndex}`} paperSize={paperSize}>
                {pageIndex === 0 && <PreviewHeader contact={contact} />}
                {pageSections.map((section) => (
                  <PreviewSection key={`${section.id}-${pageIndex}`} section={section} />
                ))}
              </PreviewPage>
            ))}
          </div>
        </div>
      </div>

      {/* Offscreen, unpaginated, unscaled render that page splitting measures. */}
      <div className="pointer-events-none fixed top-0 -left-24999.75" aria-hidden>
        <div ref={measureRootRef} style={{ width: `${pageContentSize.width}px` }}>
          <PreviewHeader contact={contact} />
          {activeSections.map((section) => (
            <PreviewSection key={`measure-${section.id}`} section={section} />
          ))}
        </div>
      </div>
    </>
  );
}
