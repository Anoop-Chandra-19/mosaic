import { create } from 'zustand';
import type { OpenedBackup } from '@/types/bundle';
import type { Version } from '@/types/db';

/** What is showing over the app right now. Never persisted. */

export interface ToastAction {
  label: string;
  run: () => void;
}

export interface Toast {
  id: number;
  message: string;
  tone: 'success' | 'error';
  /** One follow-up, such as Undo. Running it dismisses the toast. */
  action?: ToastAction;
}

/** A version being read in the sheet instead of the draft. */
export interface VersionPreview {
  version: Version;
  /** "v3" — its place in the template's history. */
  label: string;
}

/** A version to export instead of the open draft. */
export interface ExportVersion extends VersionPreview {
  templateName: string;
}

interface OverlayState {
  /**
   * The Start panel: shown at a launch with no templates (see `hydrateStores`), and from
   * New template. Deleting the last template during a session does not bring it back —
   * the app then simply has nothing open.
   */
  startOpen: boolean;
  importOpen: boolean;
  /** The import can only become a new template (nothing is open, or it came from Start). */
  importAsNewOnly: boolean;
  nameVersionOpen: boolean;
  exportOpen: boolean;
  /** What the Export dialog exports: this version, or the open draft when null. */
  exportVersion: ExportVersion | null;
  /** A backup file chosen for restoring, waiting for the user to confirm. */
  pendingRestore: OpenedBackup | null;
  /**
   * Reading a version before deciding to restore it. The draft is never touched; the
   * preview ends on Back to draft, a restore, or when a different draft is loaded.
   */
  preview: VersionPreview | null;
  toast: Toast | null;
  setStartOpen: (open: boolean) => void;
  openImport: (asNewOnly: boolean) => void;
  closeImport: () => void;
  setNameVersionOpen: (open: boolean) => void;
  /** Opens Export for the open draft, or for `version`. */
  openExport: (version?: ExportVersion) => void;
  closeExport: () => void;
  setPendingRestore: (backup: OpenedBackup | null) => void;
  setPreview: (preview: VersionPreview | null) => void;
  dismissToast: () => void;
}

export const useOverlayStore = create<OverlayState>()((set) => ({
  startOpen: false,
  importOpen: false,
  importAsNewOnly: false,
  nameVersionOpen: false,
  exportOpen: false,
  exportVersion: null,
  pendingRestore: null,
  preview: null,
  toast: null,
  setStartOpen: (startOpen) => set({ startOpen }),
  openImport: (importAsNewOnly) => set({ importOpen: true, importAsNewOnly }),
  closeImport: () => set({ importOpen: false }),
  setNameVersionOpen: (nameVersionOpen) => set({ nameVersionOpen }),
  openExport: (version) => set({ exportOpen: true, exportVersion: version ?? null }),
  // The target stays until the next opening, so the closing dialog does not change.
  closeExport: () => set({ exportOpen: false }),
  setPendingRestore: (pendingRestore) => set({ pendingRestore }),
  setPreview: (preview) => set({ preview }),
  dismissToast: () => set({ toast: null }),
}));

const TOAST_MS = 5000;
/** Long enough to read the message and reach the button. */
const TOAST_WITH_ACTION_MS = 10000;
let nextToastId = 1;

export function showToast(
  message: string,
  tone: Toast['tone'] = 'success',
  action?: ToastAction
): void {
  const id = nextToastId++;
  useOverlayStore.setState({ toast: { id, message, tone, action } });
  setTimeout(
    () => {
      if (useOverlayStore.getState().toast?.id === id) useOverlayStore.setState({ toast: null });
    },
    action ? TOAST_WITH_ACTION_MS : TOAST_MS
  );
}

/**
 * Run a store action the user started, and say so if it fails — main refused it or the
 * disk did, and either way nothing was written.
 */
export async function attempt(action: Promise<unknown>, failure: string): Promise<boolean> {
  try {
    await action;
    return true;
  } catch (error) {
    console.error(failure, error);
    showToast(failure, 'error');
    return false;
  }
}
