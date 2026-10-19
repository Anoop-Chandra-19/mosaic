import { create } from 'zustand';

/** The header card's key among the outline's collapsible parts; sections use their ids. */
export const HEADER_OUTLINE_ID = 'header';

interface OutlineState {
  /** The header card and sections folded shut in the content editor. Open by default. */
  collapsedIds: string[];
  setOpen: (id: string, open: boolean) => void;
  /** Folds all of `ids` shut, or opens everything. */
  setAllOpen: (ids: string[], open: boolean) => void;
  /**
   * A section just added from a menu, until the outline has shown it: it comes into view
   * and washes once, and a custom one opens with its name ready to type.
   */
  addedSection: { id: string; isNaming: boolean } | null;
  noteSectionAdded: (id: string, isNaming: boolean) => void;
  clearAddedSection: () => void;
}

/**
 * Which parts of the content editor are open, and the section just added. Shared so the
 * pane's buttons and each card agree; kept for the session only, not saved.
 */
export const useOutlineStore = create<OutlineState>()((set) => ({
  collapsedIds: [],
  setOpen: (id, open) =>
    set((state) => ({
      collapsedIds: open
        ? state.collapsedIds.filter((other) => other !== id)
        : [...state.collapsedIds.filter((other) => other !== id), id],
    })),
  setAllOpen: (ids, open) => set({ collapsedIds: open ? [] : [...ids] }),
  addedSection: null,
  noteSectionAdded: (id, isNaming) => set({ addedSection: { id, isNaming } }),
  clearAddedSection: () => set({ addedSection: null }),
}));
