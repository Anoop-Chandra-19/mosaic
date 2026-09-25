import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { useOverlayStore } from '@/stores/overlayStore';
import { PREVIEW_DEFAULT_ZOOM, useUiStore } from '@/stores/uiStore';
import { PREVIEW_ZOOM_EASE_MS } from './ResumePreview';

/** Long enough for the page to land back in the preview before it zooms. */
const LANDING_MS = 380;
/** The longest a view waits for the preview to settle before it opens anyway. */
const SETTLE_LIMIT_MS = 700;

/**
 * - `fit`: a view covers the preview; it shows the page at the default zoom, from the top,
 *   so the page that moves into the view is the one the view shows.
 * - `landing`: the view closed; still fit, while the page moves back.
 * - `restoring`: easing back to the user's zoom, then their scroll.
 */
type Phase = 'live' | 'fit' | 'landing' | 'restoring';

const scrollBehavior = (): ScrollBehavior =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';

/**
 * The zoom the preview draws at, which is the user's own except around a view that covers
 * the workspace. Their zoom and scroll are never changed, only set aside and given back.
 */
export function useFitPreviewUnderSurface(scrollRef: RefObject<HTMLDivElement | null>) {
  const previewZoom = useUiStore((s) => s.previewZoom);
  // Only the history view takes the page; under the Start panel the zoom can stay.
  const isCovered = useOverlayStore((s) => s.surface?.kind === 'history');
  const [phase, setPhase] = useState<Phase>(isCovered ? 'fit' : 'live');
  const [wasCovered, setWasCovered] = useState(isCovered);
  const setAside = useRef<{ top: number; left: number } | null>(null);

  if (wasCovered !== isCovered) {
    setWasCovered(isCovered);
    setPhase(isCovered ? 'fit' : 'landing');
  }

  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    if (phase === 'fit') {
      setAside.current ??= { top: scroller.scrollTop, left: scroller.scrollLeft };
      scroller.scrollTo({ top: 0, left: 0, behavior: scrollBehavior() });
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
  return { zoom: isFit ? PREVIEW_DEFAULT_ZOOM : previewZoom, isZoomEased: phase !== 'live' };
}

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));
const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/**
 * Resolves once the preview has eased to fit and scrolled to the top, so a view opening
 * over it takes the page from there. At once when it was there already. The scroll is
 * watched, not awaited as `scrollend`: the zoom easing out clamps it to the top, which
 * ends no scroll.
 */
export async function waitForPreviewToFit(): Promise<void> {
  const scroller = document.querySelector<HTMLElement>('[data-workspace] [data-page-viewport]');
  if (!scroller) return;
  const isAtTop = () => scroller.scrollTop === 0 && scroller.scrollLeft === 0;
  const isZoomed = useUiStore.getState().previewZoom !== PREVIEW_DEFAULT_ZOOM;
  if (!isZoomed && isAtTop()) return;
  const giveUpAt = performance.now() + SETTLE_LIMIT_MS;
  if (isZoomed) await wait(PREVIEW_ZOOM_EASE_MS);
  while (!isAtTop() && performance.now() < giveUpAt) await nextFrame();
}
