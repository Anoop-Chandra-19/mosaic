import { create } from 'zustand';
import type { ShortcutPlace } from '@/lib/shortcutCatalog';
import type { HistoryComparison, HistoryFilter } from '@/types/history';
import type { SettingsSectionId } from '@/types/settings';
import type { OpenedBackup } from '@shared/types/bundle';
import type { VersionPreview } from './previewStore';

/**
 * What covers the app right now: a surface over the workspace, Settings, one dialog, and
 * one tour. Never persisted. Toasts are `toastStore`'s, the version being read in the sheet
 * is `previewStore`'s, and shortcuts that open something inside a feature use `targetStore`.
 */

/** A version to export instead of the open draft. */
export interface ExportVersion extends VersionPreview {
  templateName: string;
}

/**
 * A dialog to open, with what it needs. One at a time: opening one replaces another.
 * Settings is not one of them; a dialog can open over it.
 */
export type DialogRequest =
  /** `asNewOnly`: the import can only become a new template (nothing is open, or Start). */
  | { kind: 'import'; asNewOnly: boolean }
  /** `version`: what to export instead of the open draft. */
  | { kind: 'export'; version: ExportVersion | null }
  | { kind: 'nameVersion' }
  /** `place`: where the sheet was opened from; that place's keys are listed first. */
  | { kind: 'shortcuts'; place: ShortcutPlace | null }
  /** A backup file chosen for restoring, waiting for the user to confirm. */
  | { kind: 'restoreBackup'; backup: OpenedBackup };

export type DialogKind = DialogRequest['kind'];

/**
 * The dialog showing. A closed one keeps its request until another opens, so it animates
 * out unchanged.
 */
interface ShownDialog {
  request: DialogRequest;
  isOpen: boolean;
}

/**
 * A screen that covers the workspace, between the top bar and the status bar. One at a
 * time: opening one replaces another. The workspace stays mounted and inert underneath,
 * so closing a surface returns to the editor exactly as it was.
 *
 * `start`: shown at a launch with no templates (see `hydrateStores`), and from New
 * template. Deleting the last template during a session does not bring it back; the app
 * then simply has nothing open.
 *
 * `history`: one template's full history, opened on `filter` when the sidebar's was
 * carried over, and on `versionId` when one was asked for.
 *
 * `review`: the assistant's suggestions for the open template, over the app's top bar
 * too, opened on `proposalId` when one was asked for.
 */
export type WorkspaceSurface =
  | { kind: 'start' }
  | { kind: 'review'; proposalId?: string }
  | {
      kind: 'history';
      templateId: string;
      filter?: HistoryFilter;
      versionId?: string;
      /** Opened from a version being read: kept to that comparison, not remembered. */
      comparison?: HistoryComparison;
    };

/**
 * `gettingStarted`: the first-run tour over the editor. `history`: the history tour, over
 * the full history, which shows the example history meanwhile.
 */
export type TourKind = 'gettingStarted' | 'history';

/**
 * The tour running, one at a time: starting one replaces another. A dialog or surface over
 * the app hides a tour without ending it; it comes back on its step.
 */
export interface RunningTour {
  kind: TourKind;
  step: number;
}

interface OverlayState {
  surface: WorkspaceSurface | null;
  /** The Settings section showing, or null while Settings is closed. */
  settingsSection: SettingsSectionId | null;
  dialog: ShownDialog | null;
  tour: RunningTour | null;
  openSurface: (surface: WorkspaceSurface) => void;
  /** Closes the surface showing, if it is a `kind` one; any other is left alone. */
  closeSurface: (kind: WorkspaceSurface['kind']) => void;
  /** Opens Settings at `section`, General unless told otherwise. */
  openSettings: (section?: SettingsSectionId) => void;
  closeSettings: () => void;
  /** Opens `request`'s dialog, closing any other. */
  openDialog: (request: DialogRequest) => void;
  /** Closes the dialog showing, if it is a `kind` one; any other is left alone. */
  closeDialog: (kind: DialogKind) => void;
  /** Starts `kind`'s tour on its first step, ending any other. */
  startTour: (kind: TourKind) => void;
  /** Moves the running tour to `step`. */
  setTourStep: (step: number) => void;
  /** Ends the tour running, if it is a `kind` one; any other is left alone. */
  endTour: (kind: TourKind) => void;
}

export const useOverlayStore = create<OverlayState>()((set) => ({
  surface: null,
  settingsSection: null,
  dialog: null,
  tour: null,
  openSurface: (surface) => set({ surface }),
  // The history tour runs on the full history, so closing it ends the tour too.
  closeSurface: (kind) =>
    set((state) => {
      if (state.surface?.kind !== kind) return state;
      const isHistoryTourOn = kind === 'history' && state.tour?.kind === 'history';
      return isHistoryTourOn ? { surface: null, tour: null } : { surface: null };
    }),
  openSettings: (section = 'general') => set({ settingsSection: section }),
  closeSettings: () => set({ settingsSection: null }),
  openDialog: (request) => set({ dialog: { request, isOpen: true } }),
  closeDialog: (kind) =>
    set((state) =>
      state.dialog?.request.kind === kind ? { dialog: { ...state.dialog, isOpen: false } } : state
    ),
  startTour: (kind) => set({ tour: { kind, step: 0 } }),
  setTourStep: (step) => set((state) => (state.tour ? { tour: { ...state.tour, step } } : state)),
  endTour: (kind) => set((state) => (state.tour?.kind === kind ? { tour: null } : state)),
}));

/** For reading one tour: its step while it runs, else null. */
export const selectTourStep =
  (kind: TourKind) =>
  (state: OverlayState): number | null =>
    state.tour?.kind === kind ? state.tour.step : null;

/**
 * For a dialog to read itself: whether it is open, and its request while it is the one
 * showing (open, or animating out).
 */
export function useDialog<K extends DialogKind>(kind: K) {
  const dialog = useOverlayStore((s) => (s.dialog?.request.kind === kind ? s.dialog : null));
  return {
    isOpen: dialog?.isOpen ?? false,
    request: (dialog?.request ?? null) as Extract<DialogRequest, { kind: K }> | null,
  };
}
