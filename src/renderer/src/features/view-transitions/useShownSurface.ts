import { useDeferredValue } from 'react';
import { useOverlayStore, type WorkspaceSurface } from '@/stores/overlayStore';

/**
 * The view to render over the workspace: Start, history, review, or null for none.
 * The store changes immediately; this deferred value lets React animate the change.
 * Use it when rendering the view, rather than reading the store directly.
 */
export function useShownSurface() {
  const surface = useOverlayStore((s) => s.surface);
  return useDeferredValue(surface);
}

// History and review replace the workspace visually; Start keeps it visible but blurred.
const REPLACES_THE_WORKSPACE: ReadonlySet<WorkspaceSurface['kind']> = new Set([
  'history',
  'review',
]);

/** Whether the current view replaces the workspace instead of leaving it visible behind. */
export function useIsWorkspaceReplaced(): boolean {
  const shown = useShownSurface();
  return shown !== null && REPLACES_THE_WORKSPACE.has(shown.kind);
}
