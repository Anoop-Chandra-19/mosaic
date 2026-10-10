import { MOTION_EASE, MOTION_EASE_IN, MOTION_MS, prefersReducedMotion } from './motionTiming';
import {
  readPresenceFrame,
  type PresenceFrames,
  type PresenceMotion,
  type PresencePhase,
} from './presenceMotions';

function animatePart(
  element: HTMLElement,
  phase: PresencePhase,
  from: PresenceFrames | undefined,
  hidden: { opacity: string; transform: string },
  durationMs: number,
  delayMs = 0
) {
  const resting = readPresenceFrame(element);
  const isEntering = phase === 'enter';
  const animation = element.animate(
    [from?.get(element) ?? (isEntering ? hidden : resting), isEntering ? resting : hidden],
    {
      duration: durationMs,
      delay: delayMs,
      easing: isEntering ? MOTION_EASE : MOTION_EASE_IN,
      fill: 'both',
    }
  );
  animation.id = `presence-${phase}`;
  return animation;
}

/**
 * Direct children of `data-presence-list` arrive in order; `data-presence-stretch` grows
 * beside them. Departure reverses both without staggering. Presence waits for the group.
 */
export const stagger: PresenceMotion = (element, phase, from) => {
  if (prefersReducedMotion()) return null;
  const isEntering = phase === 'enter';
  const offsetPx = parseFloat(getComputedStyle(document.documentElement).fontSize) * 0.1875;
  const rows = Array.from(element.querySelector('[data-presence-list]')?.children ?? []);
  const animations = rows
    .filter((row): row is HTMLElement => row instanceof HTMLElement)
    .map((row, index) => {
      const resting = readPresenceFrame(row);
      const base = resting.transform === 'none' ? '' : ` ${resting.transform}`;
      return animatePart(
        row,
        phase,
        from,
        { opacity: '0', transform: `translateY(-${offsetPx}px)${base}` },
        isEntering ? MOTION_MS.staggerEnter : MOTION_MS.staggerExit,
        isEntering ? Math.min(index * MOTION_MS.staggerStep, MOTION_MS.staggerMaxDelay) : 0
      );
    });
  const stretch = element.querySelector<HTMLElement>('[data-presence-stretch]');
  if (stretch) {
    const resting = readPresenceFrame(stretch);
    const base = resting.transform === 'none' ? '' : ` ${resting.transform}`;
    animations.push(
      animatePart(
        stretch,
        phase,
        from,
        { opacity: resting.opacity, transform: `scaleY(0)${base}` },
        isEntering ? MOTION_MS.stretchEnter : MOTION_MS.stretchExit
      )
    );
  }
  return animations;
};
