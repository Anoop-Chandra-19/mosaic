import { create } from 'zustand';
import type { Version } from '@/types/db';

/** What is showing over the app right now. Never persisted. */

export interface Toast {
  id: number;
  message: string;
  tone: 'success' | 'error';
}

/** A version being read in the sheet instead of the draft. */
export interface VersionPreview {
  version: Version;
  /** "v3" — its place in the template's history. */
  label: string;
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
  setExportOpen: (open: boolean) => void;
  setPreview: (preview: VersionPreview | null) => void;
  dismissToast: () => void;
}

export const useOverlayStore = create<OverlayState>()((set) => ({
  startOpen: false,
  importOpen: false,
  importAsNewOnly: false,
  nameVersionOpen: false,
  exportOpen: false,
  preview: null,
  toast: null,
  setStartOpen: (startOpen) => set({ startOpen }),
  openImport: (importAsNewOnly) => set({ importOpen: true, importAsNewOnly }),
  closeImport: () => set({ importOpen: false }),
  setNameVersionOpen: (nameVersionOpen) => set({ nameVersionOpen }),
  setExportOpen: (exportOpen) => set({ exportOpen }),
  setPreview: (preview) => set({ preview }),
  dismissToast: () => set({ toast: null }),
}));

const TOAST_MS = 5000;
let nextToastId = 1;

export function showToast(message: string, tone: Toast['tone'] = 'success'): void {
  const id = nextToastId++;
  useOverlayStore.setState({ toast: { id, message, tone } });
  setTimeout(() => {
    if (useOverlayStore.getState().toast?.id === id) useOverlayStore.setState({ toast: null });
  }, TOAST_MS);
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
