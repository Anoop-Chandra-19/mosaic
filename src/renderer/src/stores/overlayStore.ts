import { create } from 'zustand';
import type { ShortcutPlace } from '@/lib/shortcutCatalog';
import type { HistoryComparison, HistoryFilter } from '@/types/history';
import type { SettingsSectionId } from '@/types/settings';
import type { OpenedBackup } from '@shared/types/bundle';
import type { VersionPreview } from './previewStore';

/**
 * What is showing over the app right now. Never persisted. Toasts are `toastStore`'s, and
 * the version being read in the sheet is `previewStore`'s.
 */

/** A version to export instead of the open draft. */
export interface ExportVersion extends VersionPreview {
  templateName: string;
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
 */
export type WorkspaceSurface =
  | { kind: 'start' }
  | {
      kind: 'history';
      templateId: string;
      filter?: HistoryFilter;
      versionId?: string;
      /** Opened from a version being read: kept to that comparison, not remembered. */
      comparison?: HistoryComparison;
    };

interface OverlayState {
  surface: WorkspaceSurface | null;
  /** The Settings section showing, or null while Settings is closed. */
  settingsSection: SettingsSectionId | null;
  importOpen: boolean;
  /** The import can only become a new template (nothing is open, or it came from Start). */
  importAsNewOnly: boolean;
  nameVersionOpen: boolean;
  /** The keyboard shortcut sheet, opened on its own with Ctrl/⌘+/. */
  shortcutsOpen: boolean;
  /** Where the sheet was opened from: that place's keys are listed first. */
  shortcutsPlace: ShortcutPlace | null;
  /** The sidebar's Add section menu, which Ctrl/⌘+Shift+N opens too. */
  addSectionMenuOpen: boolean;
  exportOpen: boolean;
  /** What the Export dialog exports: this version, or the open draft when null. */
  exportVersion: ExportVersion | null;
  /** A backup file chosen for restoring, waiting for the user to confirm. */
  pendingRestore: OpenedBackup | null;
  /**
   * The first-run tour's step while it runs, else null. A dialog or surface over the app
   * hides the tour without ending it; it comes back on this step.
   */
  tourStep: number | null;
  /**
   * The history tour's step while it runs, else null. It runs over the full history, which
   * shows the example history meanwhile; a dialog hides it without ending it.
   */
  historyTourStep: number | null;
  openSurface: (surface: WorkspaceSurface) => void;
  /** Closes the surface showing, if it is a `kind` one; any other is left alone. */
  closeSurface: (kind: WorkspaceSurface['kind']) => void;
  /** Opens Settings at `section`, General unless told otherwise. */
  openSettings: (section?: SettingsSectionId) => void;
  closeSettings: () => void;
  openImport: (asNewOnly: boolean) => void;
  closeImport: () => void;
  setNameVersionOpen: (open: boolean) => void;
  openShortcuts: (place: ShortcutPlace | null) => void;
  closeShortcuts: () => void;
  setAddSectionMenuOpen: (open: boolean) => void;
  /** Opens Export for the open draft, or for `version`. */
  openExport: (version?: ExportVersion) => void;
  closeExport: () => void;
  setPendingRestore: (backup: OpenedBackup | null) => void;
  setTourStep: (step: number | null) => void;
  setHistoryTourStep: (step: number | null) => void;
}

export const useOverlayStore = create<OverlayState>()((set) => ({
  surface: null,
  settingsSection: null,
  importOpen: false,
  importAsNewOnly: false,
  nameVersionOpen: false,
  shortcutsOpen: false,
  shortcutsPlace: null,
  addSectionMenuOpen: false,
  exportOpen: false,
  exportVersion: null,
  pendingRestore: null,
  tourStep: null,
  historyTourStep: null,
  openSurface: (surface) => set({ surface }),
  // The history tour runs on the full history, so closing it ends the tour too.
  closeSurface: (kind) =>
    set((state) => {
      if (state.surface?.kind !== kind) return state;
      return kind === 'history' ? { surface: null, historyTourStep: null } : { surface: null };
    }),
  openSettings: (section = 'general') => set({ settingsSection: section }),
  closeSettings: () => set({ settingsSection: null }),
  openImport: (importAsNewOnly) => set({ importOpen: true, importAsNewOnly }),
  closeImport: () => set({ importOpen: false }),
  setNameVersionOpen: (nameVersionOpen) => set({ nameVersionOpen }),
  openShortcuts: (shortcutsPlace) => set({ shortcutsOpen: true, shortcutsPlace }),
  // The place stays until the next opening, so the closing sheet does not change.
  closeShortcuts: () => set({ shortcutsOpen: false }),
  setAddSectionMenuOpen: (addSectionMenuOpen) => set({ addSectionMenuOpen }),
  openExport: (version) => set({ exportOpen: true, exportVersion: version ?? null }),
  // The target stays until the next opening, so the closing dialog does not change.
  closeExport: () => set({ exportOpen: false }),
  setPendingRestore: (pendingRestore) => set({ pendingRestore }),
  setTourStep: (tourStep) => set({ tourStep }),
  setHistoryTourStep: (historyTourStep) => set({ historyTourStep }),
}));
