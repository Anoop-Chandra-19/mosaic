import { useOverlayStore, type WorkspaceSurface } from '@/stores/overlayStore';

/*
 * The page handoff: a surface that shows the resume's page takes it from the live preview
 * as it opens, and gives it back as it closes. The preview and those surfaces meet here,
 * so neither imports the other.
 */

/** Surfaces that take the page. viewTransitions.css names the same ones. */
const TAKES_THE_PAGE: ReadonlySet<WorkspaceSurface['kind']> = new Set(['history']);

/** True while a surface that takes the page is up, from the moment it is asked for. */
export function useIsHandingOffPage(): boolean {
  return useOverlayStore((s) => s.surface !== null && TAKES_THE_PAGE.has(s.surface.kind));
}

let previewSettled: Promise<void> = Promise.resolve();

/**
 * The preview says when it will have eased to fit, the page at the default zoom and from
 * its top, so what moves is what the surface shows.
 */
export function reportPreviewSettling(settled: Promise<void>) {
  previewSettled = settled;
}

/** A surface opening waits on this before it takes the page. */
export function whenPreviewSettled(): Promise<void> {
  return previewSettled;
}
