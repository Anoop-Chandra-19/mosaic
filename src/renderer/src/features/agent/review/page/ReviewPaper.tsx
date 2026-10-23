import type { ReactNode, RefObject } from 'react';
import { Text } from '@/components/ui-kit';
import { PageZoomControl } from '@/features/preview/PageZoomControl';
import { useStoredPreviewZoom } from '@/features/preview/pageZoom';
import type { PageDecorations } from '@/features/preview/PreviewSection';
import { ResumePreview } from '@/features/preview/ResumePreview';
import { usePreviewCanvas } from '@/features/preview/usePreviewCanvas';
import { transitionClasses } from '@/features/view-transitions/transitionClasses';
import { cn } from '@/lib/utils';
import { useUiStore } from '@/stores/uiStore';
import type { ResumeData } from '@shared/types/resume';
import type { ResumePreviewMeta } from '@/types/preview';

const ignoreMeta = () => {};

interface ReviewPaperProps {
  doc: ResumeData;
  scrollRef: RefObject<HTMLDivElement | null>;
  decorations?: PageDecorations;
  /** A click on the paper away from anything on it. */
  onBlank?: () => void;
  onMetaChange?: (meta: ResumePreviewMeta) => void;
  onLaidOut?: () => void;
  /** Drawn over the pages, in their box: it scrolls and scales with them. */
  over?: ReactNode;
  /** A quiet line at the top of the view, over the paper. */
  notice?: string;
}

/**
 * The paper the review draws on, On the page and in Preview. It shares the editor
 * preview's zoom: it is the same sheet in the same place.
 */
export function ReviewPaper({
  doc,
  scrollRef,
  decorations,
  onBlank,
  onMetaChange = ignoreMeta,
  onLaidOut,
  over,
  notice,
}: ReviewPaperProps) {
  const paperSize = useUiStore((s) => s.paperSize);
  const zoom = useStoredPreviewZoom();
  const canvas = usePreviewCanvas(scrollRef, zoom);
  return (
    <div className="relative flex min-h-0 min-w-0 flex-col overflow-hidden border-r border-line">
      <div className="absolute top-2.5 right-3.5 z-3 flex rounded-lg border border-line-strong bg-pane p-0.5 shadow-floating">
        <PageZoomControl value={zoom.zoom} onStep={canvas.zoomByStep} onReset={canvas.resetZoom} />
      </div>
      {notice && (
        <Text
          as="p"
          variant="secondary"
          className="absolute top-3 left-4 z-3 rounded-md border border-line bg-pane px-2.25 py-0.75 text-ink-muted"
        >
          {notice}
        </Text>
      )}
      <div
        ref={scrollRef}
        onPointerDown={canvas.onPointerDown}
        onClick={onBlank}
        className={cn(
          // Paint contained: the preview's offscreen measuring copy is fixed far to the left,
          // and would otherwise stretch this box's view-transition image until it draws blank.
          'min-h-0 flex-1 overflow-auto overscroll-contain bg-pane-sunken px-5 pt-4.5 pb-19 contain-paint',
          // The preview's page moves into this box as the review opens, and back as it closes.
          transitionClasses({ name: 'page', motion: 'handoff step' }),
          canvas.panning ? 'cursor-grabbing select-none' : canvas.readyToPan && 'cursor-grab'
        )}
      >
        <div className="relative">
          <ResumePreview
            paperSize={paperSize}
            previewZoom={zoom.zoom}
            onMetaChange={onMetaChange}
            onLaidOut={onLaidOut}
            doc={doc}
            decorations={decorations}
          />
          {over}
        </div>
      </div>
    </div>
  );
}
