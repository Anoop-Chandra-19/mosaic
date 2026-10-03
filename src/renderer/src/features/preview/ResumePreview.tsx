import {
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { PageMarks } from '@/features/document-diff/pageMarks';
import { cn } from '@/lib/utils';
import { useLiveEditStore } from '@/stores/liveEditStore';
import { useResumeStore } from '@/stores/resumeStore';
import type { ResumeData } from '@shared/types/resume';
import type { PaperSize } from '@/types/paper';
import type { ResumePreviewMeta } from '@/types/preview';
import { PreviewHeader } from './PreviewHeader';
import { PreviewPage } from './PreviewPage';
import { PreviewSection } from './PreviewSection';
import {
  createFallbackMeasurements,
  MAX_PREVIEW_PAGES,
  normalizeSections,
  paginateSections,
  type PaginationMeasurements,
} from './pagination';
import { PAPER_DIMENSIONS_PT, getPageContentSize } from './pageGeometry';

interface ResumePreviewProps {
  paperSize: PaperSize;
  previewZoom?: number;
  onMetaChange: (meta: ResumePreviewMeta) => void;
  /** A document to show instead of the draft — a version being read before a restore. */
  doc?: ResumeData;
  /** Ease a change of zoom rather than jump; off while the user zooms, which must track. */
  isZoomEased?: boolean;
  /** What changed against another version, marked on the page; exports never pass this. */
  marks?: PageMarks;
  /**
   * The page is laid out from its own measurements, before it paints. Called again each
   * time its layout changes.
   */
  onLaidOut?: () => void;
}

/** Measurements, with what they were taken of, so a layout from stale ones can be told apart. */
interface MeasuredPage {
  measurements: PaginationMeasurements;
  contact: ResumeData['contact'];
  sections: ReturnType<typeof normalizeSections>;
  marks: PageMarks | undefined;
}

/** How long an eased change of zoom takes: the `duration-160` of the classes below. */
export const PREVIEW_ZOOM_EASE_MS = 160;
const ZOOM_EASE = 'duration-160 ease-settle motion-reduce:transition-none';

/** Offsets into a paragraph's text where each drawn line begins, found by word. */
function measureLineStarts(paragraph: HTMLElement): number[] {
  const text = paragraph.firstChild;
  if (!(text instanceof Text)) return [0];
  const range = document.createRange();
  const starts: number[] = [];
  let lineTop = -Infinity;
  for (const word of text.data.matchAll(/\S+/g)) {
    range.setStart(text, word.index);
    range.setEnd(text, word.index + 1);
    const top = range.getBoundingClientRect().top;
    if (top > lineTop + 1) {
      starts.push(starts.length === 0 ? 0 : word.index);
      lineTop = top;
    }
  }
  return starts.length > 0 ? starts : [0];
}

/** Measures the offscreen, unpaginated render that page splitting is driven by. */
function measurePagination(root: HTMLElement, pageContentHeight: number): PaginationMeasurements {
  const sectionTitleHeights: Record<string, number> = {};
  const entryHeights: Record<string, number> = {};
  const entryHeadingHeights: Record<string, number> = {};
  const bulletHeights: Record<string, number> = {};
  const lineStarts: Record<string, number[]> = {};

  // From the root's top, so the name's top margin, which collapses out of the header's
  // own box, is counted as the page counts it.
  const headerNode = root.querySelector<HTMLElement>('[data-preview-header]');
  const headerHeight = headerNode
    ? headerNode.getBoundingClientRect().bottom - root.getBoundingClientRect().top
    : 110;

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

  root.querySelectorAll<HTMLElement>('p[data-preview-entry-key]').forEach((node) => {
    const entryKey = node.dataset.previewEntryKey;
    if (entryKey) lineStarts[entryKey] = measureLineStarts(node);
  });

  root.querySelectorAll<HTMLElement>('[data-preview-entry-heading-key]').forEach((node) => {
    const entryKey = node.dataset.previewEntryHeadingKey;
    if (!entryKey) return;
    entryHeadingHeights[entryKey] = node.getBoundingClientRect().height;
  });

  root.querySelectorAll<HTMLElement>('[data-preview-bullet-id]').forEach((node) => {
    const bulletId = node.dataset.previewBulletId;
    if (!bulletId) return;
    bulletHeights[bulletId] = node.getBoundingClientRect().height;
    if (bulletHeights[bulletId] > pageContentHeight) lineStarts[bulletId] = measureLineStarts(node);
  });

  return {
    headerHeight,
    sectionTitleHeights,
    entryHeights,
    entryHeadingHeights,
    bulletHeights,
    lineStarts,
  };
}

const PAGE_GAP_PX = 16;

export function ResumePreview({
  paperSize,
  previewZoom = 1,
  onMetaChange,
  doc,
  isZoomEased = false,
  marks,
  onLaidOut,
}: ResumePreviewProps) {
  const draftContact = useResumeStore((s) => s.contact);
  const draftSections = useResumeStore((s) => s.sections);
  // Deferred, so a keystroke paints in its field first and the page follows. Under load
  // React skips to the newest text rather than queueing every one.
  const liveEdit = useDeferredValue(useLiveEditStore((s) => s.edit));
  const { contact, sections } = useMemo(() => {
    if (doc) return doc;
    const draft = { contact: draftContact, sections: draftSections };
    return liveEdit ? liveEdit(draft) : draft;
  }, [doc, draftContact, draftSections, liveEdit]);
  const measureRootRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [measured, setMeasured] = useState<MeasuredPage | null>(null);
  const [availableWidth, setAvailableWidth] = useState(0);

  // The sheet is a known fixed size in points, so there is nothing to measure.
  const paper = PAPER_DIMENSIONS_PT[paperSize];
  const pageContentSize = getPageContentSize(paperSize);

  const activeSections = useMemo(() => normalizeSections(sections), [sections]);

  // Measured before paint, so a change shows once, already paginated: never first with
  // the old heights and then again. Stepping between versions slides in a laid-out page.
  // Marks change the words drawn, so turning them on or off measures again.
  useLayoutEffect(() => {
    const root = measureRootRef.current;
    if (!root) return;
    const measurements = measurePagination(root, pageContentSize.height);
    setMeasured({ measurements, contact, sections: activeSections, marks });
  }, [contact, activeSections, pageContentSize.width, pageContentSize.height, marks]);

  // Track only how much room the panel gives us, so a page wider than the panel
  // can be scaled down to fit instead of overflowing. Measured before paint, so the first
  // frame (which a view transition captures) is already at its scale.
  useLayoutEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const sync = () => setAvailableWidth(node.clientWidth);
    sync();

    const observer = new ResizeObserver(sync);
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  const paginationMeasurements =
    measured?.measurements ?? createFallbackMeasurements(activeSections);
  const isMeasured =
    measured?.contact === contact &&
    measured.sections === activeSections &&
    measured.marks === marks;

  const paginated = useMemo(
    // One page past the limit, so "exactly ten" can be told from "more than ten".
    () =>
      paginateSections(
        activeSections,
        paginationMeasurements,
        pageContentSize.height,
        MAX_PREVIEW_PAGES + 1
      ),
    [activeSections, paginationMeasurements, pageContentSize.height]
  );

  const meta = useMemo<ResumePreviewMeta>(
    () => ({
      totalPages: Math.min(MAX_PREVIEW_PAGES, paginated.length),
      hasMorePages: paginated.length > MAX_PREVIEW_PAGES,
    }),
    [paginated]
  );

  useEffect(() => {
    onMetaChange(meta);
  }, [meta, onMetaChange]);

  const reportLaidOut = useEffectEvent(() => onLaidOut?.());
  useLayoutEffect(() => {
    if (isMeasured) reportLaidOut();
  }, [isMeasured, paginated]);

  const drawnPages = paginated.slice(0, MAX_PREVIEW_PAGES);

  // Chrome's PDF viewer model: the page's layout never changes, it is just
  // drawn larger or smaller. transform (not CSS zoom) is what guarantees that,
  // because transform is applied after layout and so cannot re-wrap any text.
  const fitScale = availableWidth > 0 ? Math.min(1, availableWidth / paper.width) : 1;
  const scale = fitScale * previewZoom;
  const scaledHeight =
    (paper.height * drawnPages.length + PAGE_GAP_PX * Math.max(0, drawnPages.length - 1)) * scale;

  return (
    <>
      <div ref={containerRef} className="w-full">
        {/* Reserves the post-scale footprint, since transform does not affect
            layout. mx-auto centers it when it fits and falls back to flush left
            (auto margins resolve to zero) once it is wider than the panel. */}
        <div
          data-preview-stack
          className={cn('mx-auto', isZoomEased && `transition-[width,height] ${ZOOM_EASE}`)}
          style={{ width: `${paper.width * scale}px`, height: `${scaledHeight}px` }}
        >
          <div
            className={cn(
              'flex flex-col items-start',
              isZoomEased && `transition-transform ${ZOOM_EASE}`
            )}
            style={{
              gap: `${PAGE_GAP_PX}px`,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
          >
            {drawnPages.map((pageSections, pageIndex) => (
              <PreviewPage
                key={`preview-page-${pageIndex}`}
                paperSize={paperSize}
                // One sheet needs no number; several do, as in a printed document.
                pageNumber={drawnPages.length > 1 ? pageIndex + 1 : undefined}
                pageCount={meta.totalPages}
                pageCountIsPartial={meta.hasMorePages}
              >
                {pageIndex === 0 && <PreviewHeader contact={contact} marks={marks} />}
                {pageSections.map((section) => (
                  <PreviewSection
                    key={`${section.id}-${pageIndex}`}
                    section={section}
                    marks={marks}
                  />
                ))}
              </PreviewPage>
            ))}
          </div>
        </div>
        {meta.hasMorePages && (
          <p className="mt-4 text-center text-xs text-ink-faint">
            This resume runs past {MAX_PREVIEW_PAGES} pages. The preview stops here; the export
            holds all of it.
          </p>
        )}
      </div>

      {/* Offscreen, unpaginated, unscaled render that page splitting measures. */}
      <div
        className="pointer-events-none fixed top-0 -left-24999.75"
        aria-hidden
        data-preview-measure
      >
        {/* flow-root keeps margins inside, as the page's padding does. */}
        <div
          ref={measureRootRef}
          className="flow-root font-normal tracking-normal [font-kerning:none]"
          style={{ width: `${pageContentSize.width}px` }}
        >
          {/* Marked as on the page, since a struck word takes room. */}
          <PreviewHeader contact={contact} marks={marks} />
          {activeSections.map((section) => (
            <PreviewSection key={`measure-${section.id}`} section={section} marks={marks} />
          ))}
        </div>
      </div>
    </>
  );
}
