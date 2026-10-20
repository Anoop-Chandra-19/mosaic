import { describe, expect, it } from 'vitest';
import { MOTION_MS } from '../motionTiming';
import { findStepPlace, measureStepMs } from '../stepIn';

describe('a step cut short', () => {
  it('carries on from where the content has got to', () => {
    expect(findStepPlace({ offsetPx: 12, opacity: 0.3 }, 0)).toEqual({
      offsetPx: 12,
      opacity: 0.3,
    });
    const halfway = findStepPlace({ offsetPx: -12, opacity: 0.3 }, 0.5);
    expect(halfway.offsetPx).toBe(-6);
    expect(halfway.opacity).toBeCloseTo(0.65);
    expect(findStepPlace({ offsetPx: 12, opacity: 0.3 }, 1)).toEqual({ offsetPx: 0, opacity: 1 });
  });

  it('takes the time the distance left needs, and never less than the shortest step', () => {
    expect(measureStepMs(12)).toBe(MOTION_MS.step);
    expect(measureStepMs(-6)).toBe(MOTION_MS.step / 2);
    expect(measureStepMs(1)).toBe(MOTION_MS.stepShortest);
  });
});
