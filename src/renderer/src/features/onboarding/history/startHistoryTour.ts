import { useOverlayStore } from '@/stores/overlayStore';
import { useResumeStore } from '@/stores/resumeStore';

/**
 * Starts the history tour over the open template's full history, opening it if it isn't
 * already. The tour needs the read pane, so a link from the sidebar goes there too.
 */
export function startHistoryTour(): void {
  const templateId = useResumeStore.getState().templateId;
  if (templateId === null) return;
  const overlay = useOverlayStore.getState();
  overlay.closeSettings();
  if (overlay.surface?.kind !== 'history') overlay.openSurface({ kind: 'history', templateId });
  overlay.setHistoryTourStep(0);
}
