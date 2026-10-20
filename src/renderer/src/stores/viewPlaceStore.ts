import { create } from 'zustand';
import type { ReadPaneView } from '@/types/history';

/**
 * Where the user is inside a surface, which only the surface knows: the version being read
 * in the full history, the suggestion chosen in the review. Each surface reports its own
 * while it is open, for the view's address (`features/view-address/`). Never persisted.
 */

/** The full history's place: labels, as the address writes them. */
export interface HistoryReadingPlace {
  /** "v12", "v12.1". */
  version: string;
  /** What it is compared with: "v11", "draft", or nothing for the first version. */
  base: string | null;
  reading: ReadPaneView;
}

interface ViewPlaceState {
  history: HistoryReadingPlace | null;
  /** The review's chosen suggestion, counted from 1 as the list shows them. */
  reviewSuggestion: number | null;
}

export const useViewPlaceStore = create<ViewPlaceState>()(() => ({
  history: null,
  reviewSuggestion: null,
}));
