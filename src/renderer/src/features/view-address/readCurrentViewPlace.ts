import { useOverlayStore } from '@/stores/overlayStore';
import { useResumeStore } from '@/stores/resumeStore';
import { useTemplateStore } from '@/stores/templateStore';
import { useViewPlaceStore } from '@/stores/viewPlaceStore';
import { ADDRESS_DIALOGS, type AddressDialog, type ViewPlace } from './viewPlace';

function nameTemplate(templateId: string | null): string | undefined {
  return useTemplateStore.getState().templates.find((template) => template.id === templateId)?.name;
}

function isAddressDialog(kind: string): kind is AddressDialog {
  return kind in ADDRESS_DIALOGS;
}

/**
 * Where the app is now, from what covers it down: a tour, Settings, a surface, a dialog over
 * the editor, the editor. With nothing open at all, the start screen.
 */
export function readCurrentViewPlace(): ViewPlace {
  const overlay = useOverlayStore.getState();
  const reading = useViewPlaceStore.getState();
  const openName = nameTemplate(useResumeStore.getState().templateId);
  if (overlay.tour) return { kind: 'tour', tour: overlay.tour.kind, step: overlay.tour.step + 1 };
  if (overlay.settingsSection) return { kind: 'settings', section: overlay.settingsSection };
  const surface = overlay.surface;
  if (surface?.kind === 'history') {
    const template = nameTemplate(surface.templateId) ?? '';
    const place = reading.history;
    return place
      ? {
          kind: 'history',
          template,
          version: place.version,
          base: place.base ?? undefined,
          reading: place.reading,
        }
      : { kind: 'history', template };
  }
  if (surface?.kind === 'review' && openName) {
    return {
      kind: 'review',
      template: openName,
      suggestion: reading.reviewSuggestion ?? undefined,
    };
  }
  if (surface?.kind === 'start' || !openName) return { kind: 'start' };
  const dialog = overlay.dialog?.isOpen ? overlay.dialog.request.kind : null;
  return {
    kind: 'editor',
    template: openName,
    dialog: dialog && isAddressDialog(dialog) ? dialog : undefined,
  };
}
