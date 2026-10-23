import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { ResumePreviewMeta } from '@/types/preview';
import { ReviewPaper } from '../page/ReviewPaper';
import { isSameOutlines, measureOutlines, revealOutline, type Outline } from './previewOutlines';
import type { PreviewLook, SuggestionPreview } from './suggestionPreview';

interface SuggestionPreviewPageProps {
  preview: SuggestionPreview;
  look: PreviewLook;
  /** The row the pointer is on: outlined, dashed. */
  hoveredId: string | null;
  /** The row that is open: outlined, and brought into view as it opens. */
  openId: string | null;
  onMetaChange: (meta: ResumePreviewMeta) => void;
}

const NO_OUTLINES: { hovered: Outline[]; open: Outline[] } = { hovered: [], open: [] };

/**
 * Preview's page: clean, as it would print. What a row made is outlined over it, measured
 * once the page is laid out, and again as it scales or changes.
 */
export function SuggestionPreviewPage({
  preview,
  look,
  hoveredId,
  openId,
  onMetaChange,
}: SuggestionPreviewPageProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const layerRef = useRef<HTMLDivElement | null>(null);
  const revealedIdRef = useRef<string | null>(null);
  const [outlines, setOutlines] = useState(NO_OUTLINES);

  const measure = () => {
    const pages = scrollRef.current;
    const layer = layerRef.current;
    if (!pages || !layer) return;
    const shapesOf = (id: string | null) =>
      id ? measureOutlines(pages, layer, preview.targets.get(id) ?? []) : [];
    const next = {
      hovered: hoveredId === openId ? [] : shapesOf(hoveredId),
      open: shapesOf(openId),
    };
    setOutlines((shown) =>
      isSameOutlines(shown.hovered, next.hovered) && isSameOutlines(shown.open, next.open)
        ? shown
        : next
    );
    // Once per opening: after that, the page is the reader's to scroll.
    if (openId !== revealedIdRef.current && next.open[0]) {
      revealOutline(pages, layer, next.open[0]);
      revealedIdRef.current = openId;
    }
    if (!openId) revealedIdRef.current = null;
  };
  const measureFromEffect = useEffectEvent(measure);

  useLayoutEffect(() => measureFromEffect(), [preview, hoveredId, openId]);
  // Zooming scales the pages, and the layer with them.
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    const observer = new ResizeObserver(() => measureFromEffect());
    observer.observe(layer);
    return () => observer.disconnect();
  }, []);

  const isDraftAsItIs = look === 'kept' && preview.landedCount === 0;
  return (
    <ReviewPaper
      doc={preview.doc}
      scrollRef={scrollRef}
      onMetaChange={onMetaChange}
      onLaidOut={measure}
      notice={isDraftAsItIs ? 'Nothing kept yet. This is your draft as it is.' : undefined}
      over={
        <div ref={layerRef} className="pointer-events-none absolute inset-0">
          {outlines.hovered.map((outline, index) => (
            <OutlineShape key={`hovered-${index}`} outline={outline} isOpen={false} />
          ))}
          {outlines.open.map((outline, index) => (
            <OutlineShape key={`open-${index}`} outline={outline} isOpen />
          ))}
        </div>
      }
    />
  );
}

function OutlineShape({ outline, isOpen }: { outline: Outline; isOpen: boolean }) {
  return (
    <div
      className={cn(
        'absolute z-2 rounded-sm',
        isOpen
          ? 'border-[1.5px] border-paper-suggested bg-paper-outline-open'
          : 'border border-dashed border-paper-outline'
      )}
      style={outline}
    />
  );
}
