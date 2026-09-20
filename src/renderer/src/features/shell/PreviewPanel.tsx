import { useEffect } from 'react';
import { Minus, Plus, TriangleAlert } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ResumePreview } from '@/features/preview/ResumePreview';
import { cn } from '@/lib/utils';
import type { PaperSize } from '@/types/paper';
import { VersionPreviewBanner } from '@/features/templates/VersionPreviewBanner';
import { useOverlayStore } from '@/stores/overlayStore';
import { PREVIEW_ZOOM_STEPS, useUiStore } from '@/stores/uiStore';

export function PreviewPanel() {
  const paperSize = useUiStore((s) => s.paperSize);
  const setPaperSize = useUiStore((s) => s.setPaperSize);
  const previewZoom = useUiStore((s) => s.previewZoom);
  const zoomPreviewIn = useUiStore((s) => s.zoomPreviewIn);
  const zoomPreviewOut = useUiStore((s) => s.zoomPreviewOut);
  const meta = useOverlayStore((s) => s.previewMeta);
  const setMeta = useOverlayStore((s) => s.setPreviewMeta);
  const preview = useOverlayStore((s) => s.preview);

  useEffect(() => {
    // Expose paper size to global CSS for page-specific print/preview styling.
    document.documentElement.dataset.paperSize = paperSize;
  }, [paperSize]);

  // One page is the thing to aim for, so anything longer is called out rather than stated.
  const runsLong = meta.totalPages > 1;
  const minZoom = PREVIEW_ZOOM_STEPS[0];
  const maxZoom = PREVIEW_ZOOM_STEPS[PREVIEW_ZOOM_STEPS.length - 1];

  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-background">
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
                : 'border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'
            )}
          >
            {runsLong && <TriangleAlert className="size-3" />}
            {meta.totalPages}
            {meta.hasMorePages && '+'} {meta.totalPages === 1 ? 'page' : 'pages'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="inline-flex items-center gap-1">
            <AppButton
              variant="ghost"
              size="xs"
              shape="square"
              onClick={zoomPreviewOut}
              disabled={previewZoom <= minZoom}
              aria-label="Zoom preview out"
            >
              <Minus className="size-3.5" />
            </AppButton>
            <span className="min-w-10 text-center text-xs font-semibold text-zinc-600 dark:text-zinc-400">
              {Math.round(previewZoom * 100)}%
            </span>
            <AppButton
              variant="ghost"
              size="xs"
              shape="square"
              onClick={zoomPreviewIn}
              disabled={previewZoom >= maxZoom}
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
                className="h-[1.625rem] px-2 text-xs font-semibold"
              >
                {size === 'a4' ? 'A4' : 'Letter'}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-3 py-4 md:px-6 md:py-6">
        <ResumePreview
          paperSize={paperSize}
          previewZoom={previewZoom}
          onMetaChange={setMeta}
          doc={preview?.version.doc}
        />
      </div>
    </main>
  );
}
