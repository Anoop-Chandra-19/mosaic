/**
 * The app's easing for things settling into place: CSS's `--ease-settle` (index.css), for
 * `element.animate()`, which can't read a CSS variable. Change both together.
 */
export const MOTION_EASE = 'cubic-bezier(0.2, 0.7, 0.3, 1)';

/** For things leaving: slow off the mark, gone fast. */
export const MOTION_EASE_IN = 'cubic-bezier(0.4, 0, 1, 1)';

/** Every duration the app's script motion uses. CSS keyframes keep theirs in index.css. */
export const MOTION_MS = {
  slide: 220,
  height: 200,
  appear: 180,
  /** An arrival waits for its space to open: a removal run backwards. */
  appearDelay: 170,
  leave: 140,
  travel: 260,
  fold: 220,
  carryTint: 900,
  carryTintDelay: 140,
  changeFlash: 1300,
} as const;

/** With reduced motion nothing moves, so there is nothing to animate or wait for. */
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
