import { changeInViewTransition } from '@/features/view-transitions/changeInViewTransition';
import { useOverlayStore } from '@/stores/overlayStore';
import { useUiStore } from '@/stores/uiStore';
import { HISTORY_TOUR_EXPLAINS } from './historyTourSteps';

/**
 * Ends the history tour: the veil leaves and the user's own history comes back in one
 * cross-fade. Finishing marks what the tour explained as seen; closing early marks nothing.
 */
export function endHistoryTour(isComplete = false): void {
  if (isComplete) useUiStore.getState().markHistoryTipsSeen(HISTORY_TOUR_EXPLAINS);
  changeInViewTransition(() => useOverlayStore.getState().endTour('history'));
}
