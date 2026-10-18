import type { WorkspaceSurface } from '@/stores/overlayStore';
import { useIsSurfaceAround } from './surfaceAround';

// A surface that takes the sides: the editor steps aside to the left and the assistant pane
// hands its column over. Both sides meet here, so neither imports the other.

const TAKES_THE_SIDES: ReadonlySet<WorkspaceSurface['kind']> = new Set(['review']);

/**
 * From the moment such a surface is asked for until its leaving has finished. The sidebar
 * and the assistant pane carry their names only then, so other views coming and going (the
 * history, which takes the workspace whole) leave them alone.
 */
export function useIsSideHandover(): boolean {
  return useIsSurfaceAround((surface) => TAKES_THE_SIDES.has(surface.kind));
}
