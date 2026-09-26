/**
 * The app's easing for things settling into place: CSS's `--ease-settle` (index.css), for
 * `element.animate()`, which can't read a CSS variable. Change both together.
 */
export const MOTION_EASE = 'cubic-bezier(0.2, 0.7, 0.3, 1)';

/** With reduced motion nothing moves, so there is nothing to animate or wait for. */
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
