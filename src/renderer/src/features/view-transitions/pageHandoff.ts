import { useOverlayStore, type WorkspaceSurface } from '@/stores/overlayStore';
import { useShownSurface } from './useShownSurface';

// A surface showing the resume's page takes it from the preview as it opens and gives it
// back as it closes. Both sides meet here, so neither imports the other.

const TAKES_THE_PAGE: ReadonlySet<WorkspaceSurface['kind']> = new Set(['history']);

/** From the moment the surface is asked for: the preview eases to fit before it's drawn. */
export function useIsHandingOffPage(): boolean {
  return useOverlayStore((s) => s.surface !== null && TAKES_THE_PAGE.has(s.surface.kind));
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
