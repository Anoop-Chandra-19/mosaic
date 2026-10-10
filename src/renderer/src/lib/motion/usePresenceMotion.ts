import { useLayoutEffect, useRef, useState, type Key } from 'react';
import { pop, readPresenceFrame, type PresenceFrame, type PresenceMotion } from './presenceMotions';

function recordPresenceFrames(element: HTMLElement, animations: Animation[]) {
  const frames = new Map<Element, PresenceFrame>([[element, readPresenceFrame(element)]]);
  for (const animation of animations) {
    const target = (animation.effect as KeyframeEffect | null)?.target;
    if (target instanceof HTMLElement) frames.set(target, readPresenceFrame(target));
  }
  return frames;
}

/**
 * Presence for one keyed box: retains its content through exit, then releases it. Features
 * use this hook; presenceMotions.ts supplies the motion, with timings in motionTiming.ts.
 * Render `shown`, key the box by its retained content's key, and attach `ref`. A replacement
 * enters afresh; the same key reverses from its visible frames. Motions may return a group
 * of animations: exit waits for all of them, and interruption cancels them together.
 */
export function usePresenceMotion<T, E extends HTMLElement = HTMLDivElement>(
  value: T | null,
  key: Key | null,
  motion: PresenceMotion = pop
) {
  const [shown, setShown] = useState(value === null ? null : { value, key });
  const ref = useRef<E>(null);
  const interrupted = useRef<{
    element: HTMLElement;
    frames: Map<Element, PresenceFrame>;
  } | null>(null);
  if (value !== null && (shown?.value !== value || shown.key !== key)) setShown({ value, key });
  const isLeaving = value === null;
  const shownKey = shown?.key;

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || shownKey === undefined) return;
    const from = interrupted.current?.element === element ? interrupted.current.frames : undefined;
    interrupted.current = null;
    const result = motion(element, isLeaving ? 'exit' : 'enter', from);
    const animations = Array.isArray(result) ? result : [result].filter((entry) => entry !== null);
    let isCurrent = true;
    const finish = () => {
      if (!isCurrent) return;
      if (isLeaving) setShown((current) => (current?.key === shownKey ? null : current));
      else animations.forEach((animation) => animation.cancel());
    };
    void Promise.allSettled(animations.map((animation) => animation.finished)).then(finish);

    // Capture before cancelling, so a quick toggle reverses rather than snapping to an end.
    return () => {
      isCurrent = false;
      interrupted.current = { element, frames: recordPresenceFrames(element, animations) };
      animations.forEach((animation) => animation.cancel());
    };
  }, [isLeaving, shownKey, motion]);

  return { shown: shown?.value ?? null, isLeaving, ref };
}
