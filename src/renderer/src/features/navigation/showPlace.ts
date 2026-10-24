import { startHistoryTour } from '@/features/onboarding/history/startHistoryTour';
import { useOverlayStore } from '@/stores/overlayStore';
import { useResumeStore } from '@/stores/resumeStore';
import { useTemplateStore } from '@/stores/templateStore';
import type { AppPlace } from './appPlace';

/*
 * Navigation: getting to a place that takes more than one store, such as another
 * template's history or a dialog on a template that isn't open. The template opens first
 * (which saves the draft), then what shows on it. Two ways:
 * - `showPlace`, over where you are: the layers' own rules decide the rest (a dialog
 *   replaces a dialog, a tour underneath comes back). A button or a link uses this.
 * - `goToPlace`, somewhere exactly: whatever covers the app goes first. A view address
 *   uses this.
 * A layer that opens or closes on its own (a surface's Esc, a button opening Settings)
 * talks to `overlayStore` directly.
 *
 * Other modules use this file and `appPlace.ts`'s type.
 */

/** Whatever covers the editor now goes: the surface, Settings, a dialog, a tour. */
function clearOverlays(): void {
  const overlay = useOverlayStore.getState();
  if (overlay.tour) overlay.endTour(overlay.tour.kind);
  overlay.closeSettings();
  if (overlay.dialog?.isOpen) overlay.closeDialog(overlay.dialog.request.kind);
  if (overlay.surface) overlay.closeSurface(overlay.surface.kind);
}

async function openTemplateIfNeeded(templateId: string): Promise<void> {
  if (useResumeStore.getState().templateId !== templateId) {
    await useTemplateStore.getState().openTemplate(templateId);
  }
}

/**
 * Shows the place over where you are, opening its template first when it belongs to one.
 * Throws when the template can't be opened, and then shows nothing.
 */
export async function showPlace(place: AppPlace): Promise<void> {
  if ('templateId' in place) await openTemplateIfNeeded(place.templateId);
  const overlay = useOverlayStore.getState();
  switch (place.kind) {
    case 'start':
      overlay.openSurface({ kind: 'start' });
      return;
    case 'editor':
      if (place.dialog) overlay.openDialog(place.dialog);
      return;
    case 'history':
      overlay.openSurface({
        kind: 'history',
        templateId: place.templateId,
        versionId: place.versionId,
        comparison: place.comparison,
        view: place.reading,
      });
      return;
    case 'review':
      overlay.openSurface({ kind: 'review', proposalId: place.proposalId });
      return;
    case 'settings':
      overlay.openSettings(place.section);
      return;
    case 'tour':
      if (place.tour === 'history') startHistoryTour();
      else overlay.startTour(place.tour);
      useOverlayStore.getState().setTourStep(place.step - 1);
  }
}

/** Goes to the place and nothing else: whatever covers the app goes first. */
export function goToPlace(place: AppPlace): Promise<void> {
  clearOverlays();
  return showPlace(place);
}
