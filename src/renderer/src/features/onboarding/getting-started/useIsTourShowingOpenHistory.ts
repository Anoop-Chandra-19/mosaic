import { selectTourStep, useOverlayStore } from '@/stores/overlayStore';
import { GETTING_STARTED_STEPS } from './gettingStartedSteps';

const selectGettingStartedStep = selectTourStep('gettingStarted');

/** The tour's step points at the open template's history, which unfolds for it. */
export function useIsTourShowingOpenHistory(): boolean {
  return useOverlayStore((s) => {
    const step = selectGettingStartedStep(s);
    return step !== null && GETTING_STARTED_STEPS[step]?.showsOpenTemplateHistory === true;
  });
}
