import {
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import { isTypingField } from '@/lib/keyboardShortcuts';
import { PREVIEW_DEFAULT_ZOOM, nextPreviewZoomStep } from '@/stores/uiStore';
import type { PageZoom } from './pageZoom';

/*
 * The preview as a canvas, the way a PDF viewer works it: Ctrl or ⌘ with the wheel (or a
 * pinch, which the browser reports the same way) zooms towards the pointer, holding Space
 * or the middle button drags the page around, and the zoom readout goes back to fitting the
 * width. Zoom is the viewport's business only: the sheet keeps its true size in points, so
 * nothing here can change where a line wraps.
 */

/** How fast the wheel zooms. Chrome's own viewer is near this, and a trackpad feels right. */
const WHEEL_ZOOM_DIVISOR = 700;

/** The page stack inside the scroller, which zoom scales and panning moves. */
const STACK = '[data-preview-stack]';

/** A pointer's hold on a point of the page, kept until the new zoom has been laid out. */
interface ZoomAnchor {
  /** Where the pointer sat inside the stack, in screen pixels, before the zoom. */
  offsetX: number;
  offsetY: number;
  clientX: number;
  clientY: number;
  /** How much larger the stack is about to be drawn. */
  ratio: number;
}

export interface PreviewCanvas {
  /** Space is down, so a drag would pan rather than select. */
  readyToPan: boolean;
  /** A drag is panning the page right now. */
  panning: boolean;
  /** Zoom a step, keeping the middle of the panel where it is. */
  zoomByStep: (direction: 1 | -1) => void;
  /** Back to the page at its own size, scrolled to the top. */
  resetZoom: () => void;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
}

export function usePreviewCanvas(
  scrollRef: RefObject<HTMLDivElement | null>,
  pageZoom: PageZoom
): PreviewCanvas {
  const { zoom: shownZoom, readZoom, setZoom } = pageZoom;
  const [readyToPan, setReadyToPan] = useState(false);
  const [panning, setPanning] = useState(false);
  const anchor = useRef<ZoomAnchor | null>(null);

  const zoomAround = (nextZoom: number, clientX: number, clientY: number) => {
    const stack = scrollRef.current?.querySelector(STACK);
    const zoom = readZoom();
    if (stack) {
      const box = stack.getBoundingClientRect();
      anchor.current = {
        offsetX: clientX - box.left,
        offsetY: clientY - box.top,
        clientX,
        clientY,
        // The zoom is clamped, so the ratio is worked out from what it became.
        ratio: 1,
      };
    }
    const settled = setZoom(nextZoom);
    if (anchor.current) anchor.current.ratio = settled / zoom;
  };

  // Put the point that was under the pointer back under it, now that the new zoom is laid out.
  useLayoutEffect(() => {
    const held = anchor.current;
    anchor.current = null;
    const scroller = scrollRef.current;
    const stack = scroller?.querySelector(STACK);
    if (!held || !scroller || !stack) return;
    const box = stack.getBoundingClientRect();
    scroller.scrollLeft += box.left + held.offsetX * held.ratio - held.clientX;
    scroller.scrollTop += box.top + held.offsetY * held.ratio - held.clientY;
  }, [shownZoom, scrollRef]);

  const onWheel = useEffectEvent((event: WheelEvent) => {
    // Without a modifier the wheel scrolls, as it does anywhere else.
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const zoom = readZoom() * Math.exp(-event.deltaY / WHEEL_ZOOM_DIVISOR);
    zoomAround(zoom, event.clientX, event.clientY);
  });
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    scroller.addEventListener('wheel', onWheel, { passive: false });
    return () => scroller.removeEventListener('wheel', onWheel);
  }, [scrollRef]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || isTypingField(event.target)) return;
      setReadyToPan(true);
      // Space scrolls the panel by default; while it is a pan key, it must not.
      if (scrollRef.current?.matches(':hover')) event.preventDefault();
    };
    const release = () => setReadyToPan(false);
    const onKeyUp = (event: KeyboardEvent) => event.code === 'Space' && release();
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', release);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', release);
    };
  }, [scrollRef]);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const scroller = scrollRef.current;
      const MIDDLE_BUTTON = 1;
      if (!scroller || (!readyToPan && event.button !== MIDDLE_BUTTON)) return;
      event.preventDefault();
      setPanning(true);
      const from = {
        x: event.clientX,
        y: event.clientY,
        left: scroller.scrollLeft,
        top: scroller.scrollTop,
      };
      const onMove = (move: PointerEvent) => {
        scroller.scrollLeft = from.left - (move.clientX - from.x);
        scroller.scrollTop = from.top - (move.clientY - from.y);
      };
      const onUp = () => {
        setPanning(false);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [readyToPan, scrollRef]
  );

  const zoomByStep = (direction: 1 | -1) => {
    const scroller = scrollRef.current;
    const next = nextPreviewZoomStep(readZoom(), direction);
    if (next === undefined) return;
    if (!scroller) {
      setZoom(next);
      return;
    }
    // Around the middle of the panel: what the reader is looking at stays put.
    const box = scroller.getBoundingClientRect();
    zoomAround(next, box.left + box.width / 2, box.top + box.height / 2);
  };

  const resetZoom = () => {
    setZoom(PREVIEW_DEFAULT_ZOOM);
    scrollRef.current?.scrollTo({ left: 0, top: 0 });
  };

  return { readyToPan, panning, zoomByStep, resetZoom, onPointerDown };
}
