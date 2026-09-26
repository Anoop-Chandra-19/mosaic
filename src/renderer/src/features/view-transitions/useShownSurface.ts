import { useDeferredValue } from 'react';
import { useOverlayStore, type WorkspaceSurface } from '@/stores/overlayStore';

/**
 * The surface as drawn. Zustand updates render at once, and only a transition's render gets
 * a view transition, so this is a deferred copy of the store's.
 */
export function useShownSurface() {
  const surface = useOverlayStore((s) => s.surface);
  return useDeferredValue(surface);
}

// Not the Start panel: it shows the workspace blurred behind it.
const REPLACES_THE_WORKSPACE: ReadonlySet<WorkspaceSurface['kind']> = new Set(['history']);

export function useIsWorkspaceReplaced(): boolean {
  const shown = useShownSurface();
  return shown !== null && REPLACES_THE_WORKSPACE.has(shown.kind);
}
