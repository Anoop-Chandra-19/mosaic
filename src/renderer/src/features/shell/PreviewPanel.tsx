import { useEffect, useRef } from 'react';
import { TriangleAlert } from 'lucide-react';
import { Text, AppToggleGroup, AppToggleGroupItem } from '@/components/ui-kit';
import { PageZoomControl } from '@/features/preview/PageZoomControl';
import { ResumePreview } from '@/features/preview/ResumePreview';
import { useFitPreviewForHandoff } from '@/features/preview/useFitPreviewForHandoff';
import { useStoredPreviewZoom } from '@/features/preview/pageZoom';
import { usePreviewCanvas } from '@/features/preview/usePreviewCanvas';
import { cn } from '@/lib/utils';
import type { PaperSize } from '@/types/paper';
import { collectPageMarks, putGoneBack } from '@/features/document-diff/pageMarks';
import {
  useVersionPreviewComparison,
  type VersionPreviewComparison,
} from '@/features/history/useVersionPreviewComparison';
import { VersionPreviewBanner } from '@/features/history/VersionPreviewBanner';
import { useIsPageHandedOff } from '@/features/view-transitions/pageHandoff';
import { tourTargetProps } from '@/features/onboarding/tourTargets';
import { useIsSurfaceAround } from '@/features/view-transitions/surfaceAround';
import { transitionClasses } from '@/features/view-transitions/transitionClasses';
import { usePreviewStore } from '@/stores/previewStore';
import { useUiStore } from '@/stores/uiStore';

// A part of the bar that gives way as the preview narrows: it fades while its width (and
// the margin after it) closes, so its neighbours slide over, then can't be focused.
const COLLAPSIBLE =
  'max-w-40 overflow-hidden transition-[max-width,margin,opacity,visibility] duration-180 ease-settle motion-reduce:transition-none';
const COLLAPSE_BELOW_MD = `${COLLAPSIBLE} @max-md/preview:invisible @max-md/preview:mr-0 @max-md/preview:max-w-0 @max-md/preview:opacity-0`;
const COLLAPSE_BELOW_SM = `${COLLAPSIBLE} @max-sm/preview:invisible @max-sm/preview:mr-0 @max-sm/preview:max-w-0 @max-sm/preview:opacity-0`;

/** The version's page, with what differs from the draft marked when marks are on. */
function readVersionPage({ preview, draft, diff }: VersionPreviewComparison, isMarked: boolean) {
  const versionDoc = preview.version.doc;
  if (!isMarked || diff.all.length === 0) return { doc: versionDoc };
  return {
    doc: putGoneBack(versionDoc, draft, diff.all),
    marks: collectPageMarks(diff.all, 'your draft'),
  };
}

export function PreviewPanel() {
  const paperSize = useUiStore((s) => s.paperSize);
  const setPaperSize = useUiStore((s) => s.setPaperSize);
  const previewZoom = useUiStore((s) => s.previewZoom);
  const meta = usePreviewStore((s) => s.previewMeta);
  const setMeta = usePreviewStore((s) => s.setPreviewMeta);
  const isMarked = usePreviewStore((s) => s.arePreviewMarksShown);
  const comparison = useVersionPreviewComparison();
  const preview = comparison?.preview;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const canvas = usePreviewCanvas(scrollRef, useStoredPreviewZoom());
  const shown = useFitPreviewForHandoff(scrollRef);
  const isPageHandedOff = useIsPageHandedOff();
  // The bar's two ends glide as the sidebar or the pane come and go; while a surface does,
  // the bar moves with the workspace instead.
  const isBarGliding = !useIsSurfaceAround(() => true);

  useEffect(() => {
    // Expose paper size to global CSS for page-specific print/preview styling.
    document.documentElement.dataset.paperSize = paperSize;
  }, [paperSize]);

  // One page is the thing to aim for, so anything longer is called out rather than stated.
  const runsLong = meta.totalPages > 1;

  return (
    <main
      data-shortcut-place="preview"
      className="@container/preview flex flex-1 flex-col overflow-hidden bg-background"
      {...tourTargetProps('preview')}
    >
      {comparison && (
        <VersionPreviewBanner
          key={comparison.preview.version.id}
          comparison={comparison}
          pageRef={scrollRef}
        />
      )}
      <div className="flex h-10 shrink-0 items-center justify-between gap-2.5 border-b border-line bg-background px-3">
        <div
          className={cn(
            'flex min-w-0 items-center',
            transitionClasses({
              name: 'preview-bar-start',
              motion: 'glide',
              isActive: isBarGliding,
            })
          )}
        >
          {/* "Reading v7" stays at any width: it's what says this isn't the draft. */}
          <Text variant="eyebrow" className={cn('mr-2 truncate', !preview && COLLAPSE_BELOW_MD)}>
            {preview ? `Reading ${preview.label}` : 'Live Preview'}
          </Text>
          <span
            className={cn(
              'inline-flex h-5.5 shrink-0 items-center gap-1.25 rounded-sm border px-2 font-mono text-meta whitespace-nowrap tabular-nums',
              runsLong
                ? 'border-warn-line bg-warn-soft text-warn'
                : 'border-transparent bg-line text-ink-soft'
            )}
          >
            {runsLong && <TriangleAlert className="size-3" />}
            {meta.totalPages}
            {meta.hasMorePages && '+'} {meta.totalPages === 1 ? 'page' : 'pages'}
          </span>
        </div>

        <div
          className={cn(
            'flex items-center',
            transitionClasses({
              name: 'preview-bar-end',
              motion: 'glide at-end',
              isActive: isBarGliding,
            })
          )}
        >
          {/* A narrow preview gives the page all the room it has; zooming can wait. */}
          <div className={cn('mr-1.5', COLLAPSE_BELOW_SM)}>
            <PageZoomControl
              value={previewZoom}
              size="xs"
              onStep={canvas.zoomByStep}
              onReset={canvas.resetZoom}
            />
          </div>

          <AppToggleGroup
            type="single"
            value={paperSize}
            // A single-choice group reports '' when the pressed item is pressed again.
            onValueChange={(value) => value && setPaperSize(value as PaperSize)}
            aria-label="Paper size"
          >
            {(['a4', 'letter'] as PaperSize[]).map((size) => (
              <AppToggleGroupItem
                key={size}
                value={size}
                aria-label={`Switch paper size to ${size === 'a4' ? 'A4' : 'US Letter'}`}
              >
                {size === 'a4' ? 'A4' : 'Letter'}
              </AppToggleGroupItem>
            ))}
          </AppToggleGroup>
        </div>
      </div>

      <div
        ref={scrollRef}
        onPointerDown={canvas.onPointerDown}
        className={cn(
          'flex-1 overflow-auto overscroll-contain px-3 py-4 md:px-6 md:py-6',
          canvas.panning ? 'cursor-grabbing select-none' : canvas.readyToPan && 'cursor-grab',
          transitionClasses({ name: 'page', motion: 'handoff', isActive: !isPageHandedOff })
        )}
      >
        <ResumePreview
          paperSize={paperSize}
          previewZoom={shown.zoom}
          isZoomEased={shown.isZoomEased}
          onMetaChange={setMeta}
          {...(comparison && readVersionPage(comparison, isMarked))}
        />
      </div>
    </main>
  );
}
