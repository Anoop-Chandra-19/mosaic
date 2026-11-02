import { useEffect, useState } from 'react';
import type { WorkspaceSurface } from '@/stores/overlayStore';
import { useShownSurface } from './useShownSurface';
import { whenViewTransitionsSettle } from './whenViewTransitionsSettle';

/**
 * The current view after its animation finishes, or null while waiting or closed.
 * Use this to delay overlays such as the history tour; showing them mid-animation can flash.
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
