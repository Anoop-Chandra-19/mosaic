import { flushSync } from 'react-dom';
import { TRANSITION_TYPE } from './transitionClasses';

type TransitionType = (typeof TRANSITION_TYPE)[keyof typeof TRANSITION_TYPE];

/**
 * Animates a UI update, using a cross-fade unless another motion is chosen.
 * Use for changes React does not already animate, such as closing the history tour.
 * Await this before reading the changed state; it waits for the update, not the animation.
 */
export function changeInViewTransition(
  update: () => void,
  type: TransitionType = TRANSITION_TYPE.crossfade
): Promise<void> {
  if (!document.startViewTransition) {
    update();
    return Promise.resolve();
  }
  return document.startViewTransition({ update: () => flushSync(update), types: [type] })
    .updateCallbackDone;
}
