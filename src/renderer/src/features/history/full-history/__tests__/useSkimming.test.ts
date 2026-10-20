import { describe, expect, it } from 'vitest';
import { noteStepPace, RESTING_PACE, type StepPace } from '../useSkimming';

/** Steps at these times, from rest: whether each one started skimming. */
function stepsAt(times: number[], repeats: boolean[] = []): boolean[] {
  let pace: StepPace = RESTING_PACE;
  return times.map((now, index) => {
    const next = noteStepPace(pace, now, repeats[index] ?? false);
    pace = next.pace;
    return next.startsSkimming;
  });
}

describe('noteStepPace', () => {
  it('lets one step, or two quick ones, move as steps', () => {
    expect(stepsAt([0])).toEqual([false]);
    expect(stepsAt([0, 80])).toEqual([false, false]);
  });

  it('skims from a third step with each gap under 150 ms', () => {
    expect(stepsAt([0, 80, 160])).toEqual([false, false, true]);
    expect(stepsAt([0, 80, 300])).toEqual([false, false, false]);
    expect(stepsAt([0, 200, 280])).toEqual([false, false, false]);
  });

  it('skims at once on a key repeat', () => {
    expect(stepsAt([0, 500], [false, true])).toEqual([false, true]);
  });
});
