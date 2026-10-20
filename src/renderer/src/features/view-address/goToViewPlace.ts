import { startHistoryTour } from '@/features/onboarding/history/startHistoryTour';
import { useOverlayStore, type DialogRequest } from '@/stores/overlayStore';
import { useResumeStore } from '@/stores/resumeStore';
import { useTemplateStore } from '@/stores/templateStore';
import type { AddressDialog } from './viewPlace';
import type { ResolvedPlace } from './resolveViewPlace';

const DIALOG_REQUESTS: Record<AddressDialog, DialogRequest> = {
  import: { kind: 'import', asNewOnly: false },
  export: { kind: 'export', version: null },
  nameVersion: { kind: 'nameVersion' },
  shortcuts: { kind: 'shortcuts', place: null },
};

/** Whatever covers the editor now goes: the surface, Settings, a dialog, a tour. */
function clearOverlays(): void {
  const overlay = useOverlayStore.getState();
  if (overlay.tour) overlay.endTour(overlay.tour.kind);
  overlay.closeSettings();
  if (overlay.dialog?.isOpen) overlay.closeDialog(overlay.dialog.request.kind);
  if (overlay.surface) overlay.closeSurface(overlay.surface.kind);
}

async function openTemplate(templateId: string): Promise<void> {
  if (useResumeStore.getState().templateId !== templateId) {
    await useTemplateStore.getState().openTemplate(templateId);
  }
}

/** Shows the view, opening its template first when it belongs to one. */
export async function goToViewPlace(place: ResolvedPlace): Promise<void> {
  clearOverlays();
  if ('templateId' in place) await openTemplate(place.templateId);
  const overlay = useOverlayStore.getState();
  switch (place.kind) {
    case 'start':
      overlay.openSurface({ kind: 'start' });
      return;
    case 'editor':
      if (place.dialog) overlay.openDialog(DIALOG_REQUESTS[place.dialog]);
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
