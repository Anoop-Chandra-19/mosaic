import { useEffect, useRef } from 'react';
import { Minus, Plus, TriangleAlert } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { Text } from '@/components/Text';
import { AppToggleGroup, AppToggleGroupItem } from '@/components/AppToggleGroup';
import { ResumePreview } from '@/features/preview/ResumePreview';
import { useFitPreviewForHandoff } from '@/features/preview/useFitPreviewForHandoff';
import { useStoredPreviewZoom } from '@/features/preview/pageZoom';
import { usePreviewCanvas } from '@/features/preview/usePreviewCanvas';
import { cn } from '@/lib/utils';
import { shortcutLabel } from '@/lib/keyboardShortcuts';
import type { PaperSize } from '@/types/paper';
import { collectPageMarks, putGoneBack } from '@/features/document-diff/pageMarks';
import {
  useVersionPreviewComparison,
  type VersionPreviewComparison,
} from '@/features/history/useVersionPreviewComparison';
import { VersionPreviewBanner } from '@/features/history/VersionPreviewBanner';
import { useIsPageHandedOff } from '@/features/view-transitions/pageHandoff';
import { tourTargetProps } from '@/features/onboarding/tourSteps';
import { transitionClasses } from '@/features/view-transitions/transitionClasses';
import { useOverlayStore } from '@/stores/overlayStore';
import { PREVIEW_ZOOM_RANGE, useUiStore } from '@/stores/uiStore';

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
  const meta = useOverlayStore((s) => s.previewMeta);
  const setMeta = useOverlayStore((s) => s.setPreviewMeta);
  const isMarked = useOverlayStore((s) => s.arePreviewMarksShown);
  const comparison = useVersionPreviewComparison();
  const preview = comparison?.preview;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const canvas = usePreviewCanvas(scrollRef, useStoredPreviewZoom());
  const shown = useFitPreviewForHandoff(scrollRef);
  const isPageHandedOff = useIsPageHandedOff();

  useEffect(() => {
    // Expose paper size to global CSS for page-specific print/preview styling.
    document.documentElement.dataset.paperSize = paperSize;
  }, [paperSize]);

  // One page is the thing to aim for, so anything longer is called out rather than stated.
  const runsLong = meta.totalPages > 1;

  return (
    <main
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
        <div className="flex min-w-0 items-center gap-2">
          <Text variant="eyebrow" className="truncate">
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

        <div className="flex items-center gap-1.5">
          {/* A narrow window gives the page all the room it has; zooming can wait. */}
          <div className="inline-flex items-center gap-1 @max-4xl/preview:hidden">
            <AppButton
              variant="ghost"
              size="xs"
              shape="square"
              onClick={() => canvas.zoomByStep(-1)}
              disabled={previewZoom <= PREVIEW_ZOOM_RANGE.min}
              aria-label="Zoom preview out"
            >
              <Minus className="size-3.5" />
            </AppButton>
            <AppButton
              variant="ghost"
              size="xs"
              className="min-w-9.5 px-0.5 font-regular text-ink-muted tabular-nums"
              onClick={canvas.resetZoom}
              aria-label="Reset zoom"
              title={`Reset zoom. ${shortcutLabel('scroll')} zooms to the pointer, and Space drags the page.`}
            >
              {Math.round(previewZoom * 100)}%
            </AppButton>
            <AppButton
              variant="ghost"
              size="xs"
              shape="square"
              onClick={() => canvas.zoomByStep(1)}
              disabled={previewZoom >= PREVIEW_ZOOM_RANGE.max}
              aria-label="Zoom preview in"
            >
              <Plus className="size-3.5" />
            </AppButton>
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
