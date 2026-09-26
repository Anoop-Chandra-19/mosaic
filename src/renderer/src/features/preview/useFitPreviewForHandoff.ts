import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import {
  reportPreviewSettling,
  useIsHandingOffPage,
} from '@/features/view-transitions/pageHandoff';
import { PREVIEW_DEFAULT_ZOOM, useUiStore } from '@/stores/uiStore';
import { PREVIEW_ZOOM_EASE_MS } from './ResumePreview';

/** Long enough for the page to land back in the preview before it zooms. */
const LANDING_MS = 380;

/**
 * - `fit`: the page is handed off; the preview shows it at the default zoom, from the top,
 *   so the page that moves is the one the surface shows.
 * - `landing`: the page is coming back; still fit, while it moves.
 * - `restoring`: easing back to the user's zoom, then their scroll.
 */
type Phase = 'live' | 'fit' | 'landing' | 'restoring';

const EASE = 'cubic-bezier(.2, .7, .3, 1)';

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const scrollBehavior = (): ScrollBehavior => (prefersReducedMotion() ? 'auto' : 'smooth');
const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

/**
 * The zoom the preview draws at, which is the user's own except around a page handoff.
 * Their zoom and scroll are never changed, only set aside and given back.
 */
export function useFitPreviewForHandoff(scrollRef: RefObject<HTMLDivElement | null>) {
  const previewZoom = useUiStore((s) => s.previewZoom);
  const isHandingOff = useIsHandingOffPage();
  const [phase, setPhase] = useState<Phase>(isHandingOff ? 'fit' : 'live');
  const [wasHandingOff, setWasHandingOff] = useState(isHandingOff);
  const setAside = useRef<{ top: number; left: number } | null>(null);

  if (wasHandingOff !== isHandingOff) {
    setWasHandingOff(isHandingOff);
    setPhase(isHandingOff ? 'fit' : 'landing');
  }

  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    if (phase === 'fit') {
      const { scrollTop: top, scrollLeft: left } = scroller;
      setAside.current ??= { top, left };
      const isZoomed = useUiStore.getState().previewZoom !== PREVIEW_DEFAULT_ZOOM;
      const isEased = (isZoomed || top > 0 || left > 0) && !prefersReducedMotion();
      // Jump to the top, and ease the jump away with the zoom: a smooth scroll runs its own
      // clock, longer than the zoom's, and the surface waits on both.
      scroller.scrollTo({ top: 0, left: 0 });
      if (isEased && (top || left)) {
        scroller.firstElementChild?.animate(
          [{ transform: `translate(${-left}px, ${-top}px)` }, { transform: 'none' }],
          { duration: PREVIEW_ZOOM_EASE_MS, easing: EASE }
        );
      }
      reportPreviewSettling(isEased ? wait(PREVIEW_ZOOM_EASE_MS) : Promise.resolve());
      return;
    }
    if (phase === 'landing') {
      const timer = window.setTimeout(() => setPhase('restoring'), LANDING_MS);
      return () => window.clearTimeout(timer);
    }
    if (phase === 'restoring') {
      const timer = window.setTimeout(() => {
        const from = setAside.current;
        setAside.current = null;
        if (from) scroller.scrollTo({ ...from, behavior: scrollBehavior() });
        setPhase('live');
      }, PREVIEW_ZOOM_EASE_MS);
      return () => window.clearTimeout(timer);
    }
  }, [phase, scrollRef]);

  const isFit = phase === 'fit' || phase === 'landing';
  return {
    zoom: isFit ? PREVIEW_DEFAULT_ZOOM : previewZoom,
    isZoomEased: phase !== 'live',
  };
}
