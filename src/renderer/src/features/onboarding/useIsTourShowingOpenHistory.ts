import { useOverlayStore } from '@/stores/overlayStore';
import { TOUR_STEPS } from './tourSteps';

/** The tour's step points at the open template's history, which unfolds for it. */
export function useIsTourShowingOpenHistory(): boolean {
  return useOverlayStore(
    (s) => s.tourStep !== null && TOUR_STEPS[s.tourStep]?.showsOpenTemplateHistory === true
  );
}
