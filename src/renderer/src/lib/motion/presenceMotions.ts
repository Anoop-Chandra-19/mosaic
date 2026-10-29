import { MOTION_EASE, MOTION_EASE_IN, MOTION_MS, prefersReducedMotion } from './motionTiming';

export type PresencePhase = 'enter' | 'exit';
export interface PresenceFrame extends Keyframe {
  opacity: string;
  transform: string;
}
export type PresenceFrames = ReadonlyMap<Element, PresenceFrame>;
export type PresenceMotion = (
  element: HTMLElement,
  phase: PresencePhase,
  from?: PresenceFrames
) => Animation | Animation[] | null;

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
    [from?.get(element) ?? (isEntering ? hidden : resting), isEntering ? resting : hidden],
    {
      duration: isEntering ? MOTION_MS.presenceEnter : MOTION_MS.presenceExit,
      easing: isEntering ? MOTION_EASE : MOTION_EASE_IN,
      fill: 'both',
    }
  );
  animation.id = `presence-${phase}`;
  return animation;
};

/**
 * A box that arrives with its own CSS and, leaving, folds its space away: its height and
 * padding close to nothing while what is below moves up. Clip its overflow.
 */
export const foldAway: PresenceMotion = (element, phase) => {
  if (phase === 'enter' || prefersReducedMotion()) return null;
  const style = getComputedStyle(element);
  const animation = element.animate(
    [
      { height: style.height, paddingTop: style.paddingTop, paddingBottom: style.paddingBottom },
      { height: '0px', paddingTop: '0px', paddingBottom: '0px' },
    ],
    { duration: MOTION_MS.foldAway, easing: MOTION_EASE, fill: 'both' }
  );
  animation.id = 'presence-exit';
  return animation;
};

/** A notice fades without moving the controls around it. */
export const fade: PresenceMotion = (element, phase, from) => {
  if (prefersReducedMotion()) return null;
  const resting = readPresenceFrame(element);
  const isEntering = phase === 'enter';
  const animation = element.animate(
    [
      { opacity: from?.get(element)?.opacity ?? (isEntering ? '0' : resting.opacity) },
      { opacity: isEntering ? resting.opacity : '0' },
    ],
    {
      duration: isEntering ? MOTION_MS.presenceEnter : MOTION_MS.presenceExit,
      easing: isEntering ? MOTION_EASE : MOTION_EASE_IN,
      fill: 'both',
    }
  );
  animation.id = `presence-${phase}`;
  return animation;
};
