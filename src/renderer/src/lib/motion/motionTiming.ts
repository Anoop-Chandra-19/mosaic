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
  presenceEnter: 200,
  presenceExit: 150,
  travel: 260,
  fold: 220,
  carryTint: 900,
  carryTintDelay: 140,
  changeFlash: 1300,
  landWash: 1200,
  staggerEnter: 160,
  staggerExit: 80,
  staggerStep: 30,
  staggerMaxDelay: 90,
  stretchEnter: 180,
  stretchExit: 120,
  /** A step to another version: its words settle in; one cut short takes at least the shortest. */
  step: 200,
  stepShortest: 90,
  marksBack: 120,
} as const;

/** With reduced motion nothing moves, so there is nothing to animate or wait for. */
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
