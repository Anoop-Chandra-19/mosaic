import { useEffect, useState } from 'react';
import { useOverlayStore, type WorkspaceSurface } from '@/stores/overlayStore';
import { useShownSurface } from './useShownSurface';
import { whenViewTransitionsSettle } from './whenViewTransitionsSettle';

/**
 * True from when a matching view is requested until its closing animation finishes.
 * Use this when an element should animate only with that view, or only without it.
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
