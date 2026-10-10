import { useOverlayStore } from '@/stores/overlayStore';
import { GETTING_STARTED_STEPS } from './gettingStartedSteps';

/** The tour's step points at the open template's history, which unfolds for it. */
export function useIsTourShowingOpenHistory(): boolean {
  return useOverlayStore(
    (s) =>
      s.tourStep !== null && GETTING_STARTED_STEPS[s.tourStep]?.showsOpenTemplateHistory === true
  );
}
