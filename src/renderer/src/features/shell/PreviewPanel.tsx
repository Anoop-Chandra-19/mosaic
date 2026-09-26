import { useEffect, useRef } from 'react';
import { Minus, Plus, TriangleAlert } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ResumePreview } from '@/features/preview/ResumePreview';
import { useFitPreviewUnderSurface } from '@/features/preview/useFitPreviewUnderSurface';
import { usePreviewCanvas } from '@/features/preview/usePreviewCanvas';
import { cn } from '@/lib/utils';
import { shortcutLabel } from '@/lib/keyboardShortcuts';
import type { PaperSize } from '@/types/paper';
import { VersionPreviewBanner } from '@/features/history/VersionPreviewBanner';
import { useOverlayStore } from '@/stores/overlayStore';
import { PREVIEW_ZOOM_RANGE, useUiStore } from '@/stores/uiStore';

export function PreviewPanel() {
  const paperSize = useUiStore((s) => s.paperSize);
  const setPaperSize = useUiStore((s) => s.setPaperSize);
  const previewZoom = useUiStore((s) => s.previewZoom);
  const meta = useOverlayStore((s) => s.previewMeta);
  const setMeta = useOverlayStore((s) => s.setPreviewMeta);
  const preview = useOverlayStore((s) => s.preview);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const canvas = usePreviewCanvas(scrollRef);
  const shown = useFitPreviewUnderSurface(scrollRef);

  useEffect(() => {
    // Expose paper size to global CSS for page-specific print/preview styling.
    document.documentElement.dataset.paperSize = paperSize;
  }, [paperSize]);

  // One page is the thing to aim for, so anything longer is called out rather than stated.
  const runsLong = meta.totalPages > 1;

  return (
    <main className="@container/preview flex flex-1 flex-col overflow-hidden bg-background">
      {preview && <VersionPreviewBanner preview={preview} />}
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-2.5 md:px-6">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold tracking-widest text-zinc-900 uppercase dark:text-zinc-100">
            {preview ? `Previewing ${preview.label}` : 'Live Preview'}
          </span>
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold',
              runsLong
                ? 'border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300'
                : 'border-line-strong bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'
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
              className="min-w-11 font-semibold text-ink-soft"
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

          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={paperSize}
            // A single-choice group reports '' when the pressed item is pressed again.
            onValueChange={(value) => value && setPaperSize(value as PaperSize)}
            aria-label="Paper size"
          >
            {(['a4', 'letter'] as PaperSize[]).map((size) => (
              <ToggleGroupItem
                key={size}
                value={size}
                aria-label={`Switch paper size to ${size === 'a4' ? 'A4' : 'US Letter'}`}
                className="h-6.5 px-2 text-xs font-semibold"
              >
                {size === 'a4' ? 'A4' : 'Letter'}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>

      <div
        ref={scrollRef}
        data-page-viewport
        onPointerDown={canvas.onPointerDown}
        className={cn(
          'flex-1 overflow-auto overscroll-contain px-3 py-4 md:px-6 md:py-6',
          canvas.panning ? 'cursor-grabbing select-none' : canvas.readyToPan && 'cursor-grab'
        )}
      >
        <ResumePreview
          paperSize={paperSize}
          previewZoom={shown.zoom}
          zoomTransition={shown.zoomTransition}
          onMetaChange={setMeta}
          doc={preview?.version.doc}
        />
      </div>
    </main>
  );
}
