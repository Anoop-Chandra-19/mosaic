import { useOverlayStore, type WorkspaceSurface } from '@/stores/overlayStore';
import { useShownSurface } from './useShownSurface';

// Moves the resume page between the preview and history/review during a transition.
// These views share the `page` transition name; only one may use it at a time.

const TAKES_THE_PAGE: ReadonlySet<WorkspaceSurface['kind']> = new Set(['history', 'review']);

// History opens at fit-to-view zoom; review uses the workspace preview's zoom.
const READS_AT_FIT: ReadonlySet<WorkspaceSurface['kind']> = new Set(['history']);

/**
 * True as soon as history is requested, so the preview can fit the page before it opens.
 * Review does not need this: it keeps the preview's zoom.
 */
export function useIsHandingOffPage(): boolean {
  return useOverlayStore((s) => s.surface !== null && READS_AT_FIT.has(s.surface.kind));
}

/**
 * True while history or review is rendered. The preview removes its `page` transition
 * name in the same render that gives the name to the other view.
 */
export function useIsPageHandedOff(): boolean {
  const shown = useShownSurface();
  return shown !== null && TAKES_THE_PAGE.has(shown.kind);
}

let previewSettled: Promise<void> = Promise.resolve();

/** Called by the preview to report when its zoom and scroll adjustment will finish. */
export function reportPreviewSettling(settled: Promise<void>) {
  previewSettled = settled;
}

/** History waits for the preview's zoom and scroll to finish before opening. */
export function whenPreviewSettled(): Promise<void> {
  return previewSettled;
}
