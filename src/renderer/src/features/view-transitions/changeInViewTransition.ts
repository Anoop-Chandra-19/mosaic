import { flushSync } from 'react-dom';
import { TRANSITION_TYPE } from './transitionClasses';

/**
 * Makes a store change as one view transition: the page before and after it cross-fade,
 * rather than each layer the change touches painting on its own. For a change outside
 * React's own transitions, such as a tour's veil leaving as the view under it changes.
 * React renders the change inside the transition, so the after image is its result.
 */
export function changeInViewTransition(update: () => void): void {
  if (!document.startViewTransition) {
    update();
    return;
  }
  document.startViewTransition({
    update: () => flushSync(update),
    types: [TRANSITION_TYPE.crossfade],
  });
}
