import { useEffect, useState } from 'react';
import { Minus, Plus, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ResumePreview, type ResumePreviewMeta } from '@/features/preview/ResumePreview';
import type { PaperSize } from '@/types/ui';
import { PREVIEW_ZOOM_STEPS, useUIStore } from '@/stores/uiStore';

const DEFAULT_META: ResumePreviewMeta = {
  visiblePages: 1,
  totalPages: 1,
  hasOverflowBeyondTwo: false,
};

export function PreviewPanel() {
  const paperSize = useUIStore((s) => s.paperSize);
  const setPaperSize = useUIStore((s) => s.setPaperSize);
  const previewZoom = useUIStore((s) => s.previewZoom);
  const zoomPreviewIn = useUIStore((s) => s.zoomPreviewIn);
  const zoomPreviewOut = useUIStore((s) => s.zoomPreviewOut);
  const [meta, setMeta] = useState<ResumePreviewMeta>(DEFAULT_META);

  useEffect(() => {
    document.documentElement.dataset.paperSize = paperSize;
  }, [paperSize]);

  const pageLabel = meta.hasOverflowBeyondTwo ? '2+' : `${meta.visiblePages}`;
  const minZoom = PREVIEW_ZOOM_STEPS[0];
  const maxZoom = PREVIEW_ZOOM_STEPS[PREVIEW_ZOOM_STEPS.length - 1];

  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-background">
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-2.5 md:px-6">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold tracking-widest text-zinc-900 uppercase dark:text-zinc-100">
            Live Preview
          </span>
          <span className="inline-flex items-center rounded-md border border-zinc-300 bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
            {pageLabel}{' '}
            {meta.hasOverflowBeyondTwo ? 'pages' : meta.visiblePages === 1 ? 'page' : 'pages'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="inline-flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={zoomPreviewOut}
              disabled={previewZoom <= minZoom}
              aria-label="Zoom preview out"
            >
              <Minus className="size-3.5" />
            </Button>
            <span className="min-w-10 text-center text-xs font-semibold text-zinc-600 dark:text-zinc-400">
              {Math.round(previewZoom * 100)}%
            </span>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={zoomPreviewIn}
              disabled={previewZoom >= maxZoom}
              aria-label="Zoom preview in"
            >
              <Plus className="size-3.5" />
            </Button>
          </div>

          <div className="inline-flex items-center rounded-md border border-zinc-300 bg-background p-0.5 dark:border-zinc-700">
            {(['a4', 'letter'] as PaperSize[]).map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => setPaperSize(size)}
                className={[
                  'rounded px-2 py-0.5 text-xs font-semibold uppercase transition-colors',
                  paperSize === size
                    ? 'bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100'
                    : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800',
                ].join(' ')}
                aria-label={`Switch paper size to ${size === 'a4' ? 'A4' : 'US Letter'}`}
              >
                {size === 'a4' ? 'A4' : 'Letter'}
              </button>
            ))}
          </div>

          {meta.hasOverflowBeyondTwo && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300">
              <TriangleAlert className="size-3" />
              2+ pages
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto px-3 py-4 md:px-6 md:py-6">
        <ResumePreview paperSize={paperSize} previewZoom={previewZoom} onMetaChange={setMeta} />
      </div>
    </main>
  );
}
