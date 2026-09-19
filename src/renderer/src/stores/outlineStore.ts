import { create } from 'zustand';

/** The header card's key among the outline's collapsible parts; sections use their ids. */
export const HEADER_OUTLINE_ID = 'header';

interface OutlineState {
  /** The header card and sections folded shut in the content editor. Open by default. */
  collapsedIds: string[];
  setOpen: (id: string, open: boolean) => void;
  /** Folds all of `ids` shut, or opens everything. */
  setAllOpen: (ids: string[], open: boolean) => void;
}

/**
 * Which parts of the content editor are open. Shared so the pane's collapse-all button and
 * each card agree; kept for the session only, not saved.
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
}));
