import { flushSync } from 'react-dom';
import { TRANSITION_TYPE } from './transitionClasses';

type TransitionType = (typeof TRANSITION_TYPE)[keyof typeof TRANSITION_TYPE];

/**
 * Makes a change as one view transition: by default the page before and after it
 * cross-fade, rather than each layer the change touches painting on its own. For a change
 * outside React's own transitions, such as a tour's veil leaving as the view under it
 * changes, or one inside a surface whose updates don't animate (the review's Compare all,
 * which steps). React renders the change inside the transition, so the after image is its
 * result. The change runs a frame later; the promise says when it has.
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
