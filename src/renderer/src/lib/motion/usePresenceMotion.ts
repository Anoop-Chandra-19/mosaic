import { useLayoutEffect, useRef, useState, type Key } from 'react';
import { pop, readPresenceFrame, type PresenceFrame, type PresenceMotion } from './presenceMotions';

/**
 * Presence for one keyed box: retains its content through exit, then releases it. Features
 * use this hook; presenceMotions.ts supplies the motion, with timings in motionTiming.ts.
 * Render `shown`, key the box by the supplied key, and attach `ref`. A replacement enters
 * afresh; the same key can reverse an interrupted exit from its current visible frame.
 */
export function usePresenceMotion<T>(
  value: T | null,
  key: Key | null,
  motion: PresenceMotion = pop
) {
  const [shown, setShown] = useState(value === null ? null : { value, key });
  const ref = useRef<HTMLDivElement>(null);
  const interrupted = useRef<{ element: HTMLElement; frame: PresenceFrame } | null>(null);
  if (value !== null && (shown?.value !== value || shown.key !== key)) setShown({ value, key });
  const isLeaving = value === null;
  const shownKey = shown?.key;

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || shownKey === undefined) return;
    const from = interrupted.current?.element === element ? interrupted.current.frame : undefined;
    interrupted.current = null;
    const animation = motion(element, isLeaving ? 'exit' : 'enter', from);
    let isCurrent = true;
    const finish = () => {
      if (!isCurrent) return;
      if (isLeaving) setShown((current) => (current?.key === shownKey ? null : current));
      else animation?.cancel();
    };
    void (animation?.finished ?? Promise.resolve()).then(finish, finish);

    // Capture before cancelling, so a quick toggle reverses rather than snapping to an end.
    return () => {
      isCurrent = false;
      interrupted.current = { element, frame: readPresenceFrame(element) };
      animation?.cancel();
    };
  }, [isLeaving, shownKey, motion]);

  return { shown: shown?.value ?? null, isLeaving, ref };
}
