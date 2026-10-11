import { useEffect, useState } from 'react';
import { useOverlayStore, type WorkspaceSurface } from '@/stores/overlayStore';
import { useShownSurface } from './useShownSurface';
import { whenViewTransitionsSettle } from './whenViewTransitionsSettle';

// A surface that takes the sides: the editor steps aside to the left and the assistant pane
// hands its column over. Both sides meet here, so neither imports the other.

const TAKES_THE_SIDES: ReadonlySet<WorkspaceSurface['kind']> = new Set(['review']);

const takesTheSides = (surface: WorkspaceSurface | null) =>
  surface !== null && TAKES_THE_SIDES.has(surface.kind);

/**
 * From the moment such a surface is asked for until its leaving has finished. The sidebar
 * and the assistant pane carry their names only then, so other views coming and going (the
 * history, which takes the workspace whole) leave them alone.
 */
export function useIsSideHandover(): boolean {
  const isAsked = useOverlayStore((s) => takesTheSides(s.surface));
  const isShown = takesTheSides(useShownSurface());
  const [wasShown, setWasShown] = useState(isShown);
  const [isLeaving, setIsLeaving] = useState(false);
  if (wasShown !== isShown) {
    setWasShown(isShown);
    setIsLeaving(!isShown);
  }

  useEffect(() => {
    if (!isLeaving) return;
    let isCurrent = true;
    void whenViewTransitionsSettle().then(() => isCurrent && setIsLeaving(false));
    return () => {
      isCurrent = false;
    };
  }, [isLeaving]);

  return isAsked || isShown || isLeaving;
}
