import type { JSHandle, Locator } from '@playwright/test';

export interface HeightAnimations {
  animations: Animation[];
  /** Puts the element's own `animate` back. */
  restore: () => void;
}

/**
 * Records the height animations `element.animate` starts on `box`, so a test checks that the
 * box eased without asserting intermediate pixels or timing. `isHeldAtStart` pauses each one
 * on its first frame, for checking the layout while the box is still at its old height.
 */
export function recordHeightAnimations(
  box: Locator,
  { isHeldAtStart = false } = {}
): Promise<JSHandle<HeightAnimations>> {
  return box.evaluateHandle((element, isHeld) => {
    const animations: Animation[] = [];
    const animate = element.animate.bind(element);
    element.animate = (keyframes, options) => {
      const animation = animate(keyframes, options);
      if (
        animation.effect instanceof KeyframeEffect &&
        animation.effect.getKeyframes().some((frame) => 'height' in frame)
      ) {
        if (isHeld) {
          animation.pause();
          animation.currentTime = 0;
        }
        animations.push(animation);
      }
      return animation;
    };
    return { animations, restore: () => (element.animate = animate) };
  }, isHeldAtStart);
}
