import { create } from 'zustand';
import type { ResumePreviewMeta } from '@/types/preview';
import type { Version } from '@shared/types/db';

/** What the sheet shows: the draft, or a version being read instead. Never persisted. */

/** A version being read in the sheet instead of the draft. */
export interface VersionPreview {
  version: Version;
  /** "v3" — its place in the template's history. */
  label: string;
}

interface PreviewState {
  /**
   * Reading a version before deciding to restore it. The draft is never touched; the
   * preview ends on Back to draft, a restore, or when a different draft is loaded.
   */
  preview: VersionPreview | null;
  /** Whether the version being read has its differences from the draft marked. */
  arePreviewMarksShown: boolean;
  /** How the sheet paginated, as the preview measured it; the status bar repeats it. */
  previewMeta: ResumePreviewMeta;
  setPreview: (preview: VersionPreview | null) => void;
  togglePreviewMarks: () => void;
  setPreviewMeta: (meta: ResumePreviewMeta) => void;
}

export const usePreviewStore = create<PreviewState>()((set) => ({
  preview: null,
  arePreviewMarksShown: true,
  previewMeta: { totalPages: 1, hasMorePages: false },
  setPreview: (preview) => set({ preview }),
  togglePreviewMarks: () => set((state) => ({ arePreviewMarksShown: !state.arePreviewMarksShown })),
  // The preview reports after every render; only a different count is news. Storing an
  // equal copy would re-render the preview, which reports again — a loop.
  setPreviewMeta: (meta) =>
    set((state) =>
      state.previewMeta.totalPages === meta.totalPages &&
      state.previewMeta.hasMorePages === meta.hasMorePages
        ? state
        : { previewMeta: meta }
    ),
}));
