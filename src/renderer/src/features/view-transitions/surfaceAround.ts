import { useEffect, useState } from 'react';
import { useOverlayStore, type WorkspaceSurface } from '@/stores/overlayStore';
import { useShownSurface } from './useShownSurface';
import { whenViewTransitionsSettle } from './whenViewTransitionsSettle';

/**
 * Whether a surface that `matches` is around: from the moment it is asked for until its
 * leaving has finished. An element that should move only with such a surface, or only
 * without one, carries its name on this.
 */
export function useIsSurfaceAround(matches: (surface: WorkspaceSurface) => boolean): boolean {
  const asked = useOverlayStore((s) => s.surface);
  const shown = useShownSurface();
  const isAsked = asked !== null && matches(asked);
  const isShown = shown !== null && matches(shown);
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
