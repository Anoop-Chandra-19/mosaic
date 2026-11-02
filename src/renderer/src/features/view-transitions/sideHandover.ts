import type { WorkspaceSurface } from '@/stores/overlayStore';
import { useIsSurfaceAround } from './surfaceAround';

// Review hides the sidebar and replaces the assistant pane with the inspector.
// This hook coordinates their transitions without either component importing the other.

const TAKES_THE_SIDES: ReadonlySet<WorkspaceSurface['kind']> = new Set(['review']);

/**
 * True from when review is requested until its closing animation finishes.
 * Enables the side panels' transition names, so they animate separately only for review.
 */
export function useIsSideHandover(): boolean {
  return useIsSurfaceAround((surface) => TAKES_THE_SIDES.has(surface.kind));
}
