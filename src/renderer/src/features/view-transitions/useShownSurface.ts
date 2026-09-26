import { useDeferredValue } from 'react';
import { useOverlayStore } from '@/stores/overlayStore';

/**
 * The surface covering the workspace, as it is drawn. Zustand updates render at once, and
 * only a transition's render gets a view transition: a deferred copy of the store's
 * surface makes its coming and going one. Anything that moves with a surface (the history
 * view, the workspace marks) reads this, not the store; anything that must act at once
 * (the workspace going inert) reads the store.
 */
export function useShownSurface() {
  const surface = useOverlayStore((s) => s.surface);
  return useDeferredValue(surface);
}
