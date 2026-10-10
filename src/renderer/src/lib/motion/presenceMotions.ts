import { MOTION_EASE, MOTION_EASE_IN, MOTION_MS, prefersReducedMotion } from './motionTiming';

export type PresencePhase = 'enter' | 'exit';
export interface PresenceFrame extends Keyframe {
  opacity: string;
  transform: string;
}
export type PresenceMotion = (
  element: HTMLElement,
  phase: PresencePhase,
  from?: PresenceFrame
) => Animation | null;

export function readPresenceFrame(element: HTMLElement): PresenceFrame {
  const style = getComputedStyle(element);
  return { opacity: style.opacity, transform: style.transform };
}

/** A box pops into place and leaves along the same path, from its current visible frame. */
export const pop: PresenceMotion = (element, phase, from) => {
  if (prefersReducedMotion()) return null;
  const resting = readPresenceFrame(element);
  const offsetPx = parseFloat(getComputedStyle(document.documentElement).fontSize) * 0.375;
  const baseTransform = resting.transform === 'none' ? '' : ` ${resting.transform}`;
  const hidden = {
    opacity: '0',
    transform: `translateY(${offsetPx}px) scale(0.98)${baseTransform}`,
  };
  const isEntering = phase === 'enter';
  const animation = element.animate(
    [from ?? (isEntering ? hidden : resting), isEntering ? resting : hidden],
    {
      duration: isEntering ? MOTION_MS.presenceEnter : MOTION_MS.presenceExit,
      easing: isEntering ? MOTION_EASE : MOTION_EASE_IN,
      fill: 'both',
    }
  );
  animation.id = `presence-${phase}`;
  return animation;
};
