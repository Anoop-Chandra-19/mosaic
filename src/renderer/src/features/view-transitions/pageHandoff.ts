import { useOverlayStore, type WorkspaceSurface } from '@/stores/overlayStore';
import { useShownSurface } from './useShownSurface';

// A surface showing the resume's page takes it from the preview as it opens and gives it
// back as it closes. Both sides meet here, so neither imports the other.

const TAKES_THE_PAGE: ReadonlySet<WorkspaceSurface['kind']> = new Set(['history', 'review']);

/** Of those, the ones that read the page at their own zoom, starting at fit. */
const READS_AT_FIT: ReadonlySet<WorkspaceSurface['kind']> = new Set(['history']);

/**
 * From the moment such a surface is asked for: the preview eases to fit before it's drawn,
 * so the page that moves is the one the surface shows. The review shares the preview's zoom.
 */
export function useIsHandingOffPage(): boolean {
  return useOverlayStore((s) => s.surface !== null && READS_AT_FIT.has(s.surface.kind));
}

/** While the surface is drawn, so the page's name moves sides in one commit. */
export function useIsPageHandedOff(): boolean {
  const shown = useShownSurface();
  return shown !== null && TAKES_THE_PAGE.has(shown.kind);
}

let previewSettled: Promise<void> = Promise.resolve();

export function reportPreviewSettling(settled: Promise<void>) {
  previewSettled = settled;
}

/** A surface waits on this before taking the page. */
export function whenPreviewSettled(): Promise<void> {
  return previewSettled;
}
