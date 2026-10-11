import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { PageZoomControl } from '@/features/preview/PageZoomControl';
import { useStoredPreviewZoom } from '@/features/preview/pageZoom';
import type { PageDecorations } from '@/features/preview/PreviewSection';
import { ResumePreview } from '@/features/preview/ResumePreview';
import { usePreviewCanvas } from '@/features/preview/usePreviewCanvas';
import { transitionClasses } from '@/features/view-transitions/transitionClasses';
import { cn } from '@/lib/utils';
import { useUiStore } from '@/stores/uiStore';
import { SuggestionMark, SuggestionMoveChip } from './SuggestionMark';
import type { SuggestionPage } from './suggestionPage';

const ignoreMeta = () => {};

/** The page's marks, built once per page so selecting one never lays the page out again. */
function decorateSuggestions(page: SuggestionPage): PageDecorations {
  const wrapEntry = (entryId: string, node: ReactNode) => {
    const mark = page.byEntry.get(entryId);
    return mark ? <SuggestionMark mark={mark}>{node}</SuggestionMark> : node;
  };
  return {
    bullet: (bulletId, text) => {
      const mark = page.byBullet.get(bulletId);
      const move = page.moves.get(bulletId);
      if (!mark && !move) return text;
      return (
        <>
          {mark ? <SuggestionMark mark={mark}>{text}</SuggestionMark> : text}
          {move && <SuggestionMoveChip move={move} />}
        </>
      );
    },
    entryHeading: wrapEntry,
    entryDates: wrapEntry,
  };
}

interface ReviewPageProps {
  page: SuggestionPage;
  selectedId: string | null;
  /** A click on the paper away from any mark. */
  onBlank: () => void;
}

/**
 * The page as Apply would leave it, every waiting suggestion marked where it lands. It
 * shares the editor preview's zoom: it is the same sheet in the same place.
 */
export function ReviewPage({ page, selectedId, onBlank }: ReviewPageProps) {
  const paperSize = useUiStore((s) => s.paperSize);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const zoom = useStoredPreviewZoom();
  const canvas = usePreviewCanvas(scrollRef, zoom);
  const decorations = useMemo(() => decorateSuggestions(page), [page]);

  // A suggestion picked in the list, or stepped to, comes into view on the page.
  useEffect(() => {
    if (!selectedId) return;
    scrollRef.current
      ?.querySelector(`[data-suggestion-id="${CSS.escape(selectedId)}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedId]);

  return (
    <div className="relative flex min-h-0 min-w-0 flex-col overflow-hidden border-r border-line">
      <div className="absolute top-2.5 right-3.5 z-3 flex rounded-lg border border-line-strong bg-pane p-0.5 shadow-floating">
        <PageZoomControl value={zoom.zoom} onStep={canvas.zoomByStep} onReset={canvas.resetZoom} />
      </div>
      <div
        ref={scrollRef}
        onPointerDown={canvas.onPointerDown}
        onClick={onBlank}
        className={cn(
          // Paint contained: the preview's offscreen measuring copy is fixed far to the left,
          // and would otherwise stretch this box's view-transition image until it draws blank.
          'min-h-0 flex-1 overflow-auto overscroll-contain bg-pane-sunken px-5 pt-4.5 pb-19 contain:[paint]',
          // The preview's page moves into this box as the review opens, and back as it closes.
          transitionClasses({ name: 'page', motion: 'handoff step' }),
          canvas.panning ? 'cursor-grabbing select-none' : canvas.readyToPan && 'cursor-grab'
        )}
      >
        <ResumePreview
          paperSize={paperSize}
          previewZoom={zoom.zoom}
          onMetaChange={ignoreMeta}
          doc={page.doc}
          decorations={decorations}
        />
      </div>
    </div>
  );
}
