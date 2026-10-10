import { useEffect, useState } from 'react';
import type { WorkspaceSurface } from '@/stores/overlayStore';
import { useShownSurface } from './useShownSurface';
import { whenViewTransitionsSettle } from './whenViewTransitionsSettle';

/**
 * The surface on screen once it has finished arriving, or null while it is still on its
 * way. A layer that comes with a surface (a tour over it) shows on this, not on the store:
 * painted any sooner, it lands in the view transition's images and is painted again after.
 */
export function useSettledSurface(): WorkspaceSurface | null {
  const shown = useShownSurface();
  const [settled, setSettled] = useState<WorkspaceSurface | null>(null);
  useEffect(() => {
    let isCurrent = true;
    void whenViewTransitionsSettle().then(() => isCurrent && setSettled(shown));
    return () => {
      isCurrent = false;
    };
  }, [shown]);
  return settled === shown ? settled : null;
}
