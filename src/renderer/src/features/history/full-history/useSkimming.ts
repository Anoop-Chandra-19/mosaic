import { useEffect, useRef, useState } from 'react';

/*
 * Skimming: stepping through versions faster than a step can be watched (a held key, or
 * quick presses and clicks). While skimming nothing moves and the marks are off, since marks
 * jumping many times a second is a strobe. It ends when the key comes up, or a moment after
 * the last step.
 */

/** Steps closer than this are quick; a third quick step in a row is skimming. */
const QUICK_STEP_MS = 150;
/** Skimming ends this long after the last step. */
const SETTLE_MS = 160;

export interface StepPace {
  lastStepAt: number;
  /** The step before was quick. */
  wasQuick: boolean;
}

export const RESTING_PACE: StepPace = { lastStepAt: -Infinity, wasQuick: false };

/**
 * A step at `now`: whether it starts skimming (a key repeat, or a quick step after a quick
 * one, which makes three), and the pace to judge the next by.
 */
export function noteStepPace(
  pace: StepPace,
  now: number,
  isRepeat: boolean
): { pace: StepPace; startsSkimming: boolean } {
  const isQuick = now - pace.lastStepAt < QUICK_STEP_MS;
  return {
    pace: { lastStepAt: now, wasQuick: isQuick },
    startsSkimming: isRepeat || (isQuick && pace.wasQuick),
  };
}

export function useSkimming() {
  const [isSkimming, setIsSkimming] = useState(false);
  const pace = useRef(RESTING_PACE);
  const settle = useRef(0);

  const stop = () => {
    window.clearTimeout(settle.current);
    pace.current = { ...pace.current, wasQuick: false };
    setIsSkimming(false);
  };

  /** Called for every step, with whether it came from a held key. */
  const noteStep = (isRepeat: boolean) => {
    const next = noteStepPace(pace.current, performance.now(), isRepeat);
    pace.current = next.pace;
    if (next.startsSkimming) setIsSkimming(true);
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => setIsSkimming(false), SETTLE_MS);
  };

  // Letting the key go, or leaving the window, is the end of a held key.
  useEffect(() => {
    window.addEventListener('keyup', stop);
    window.addEventListener('blur', stop);
    return () => {
      window.removeEventListener('keyup', stop);
      window.removeEventListener('blur', stop);
      window.clearTimeout(settle.current);
    };
  }, []);

  return { isSkimming, noteStep };
}
