import { MOTION_EASE, MOTION_MS, prefersReducedMotion } from './motionTiming';

/*
 * A step through a sequence (versions in the history): only what is new moves. Its content
 * comes in a short way from the side the sequence runs from and settles, and nothing of what
 * it replaced is kept. Ordinary animation, never a view transition, so nothing waits for it
 * and the next step can cut in.
 */

/** Which way the step went: toward the newer end (in from the right) or the older (left). */
export type StepDirection = 1 | -1;

/** How far the content starts from its place, in screen pixels, and how faint. */
const STEP_OFFSET_PX = 12;
const STEP_START_OPACITY = 0.3;

/** Where a step's content starts: its offset in screen pixels, and its opacity. */
export interface StepStart {
  offsetPx: number;
  opacity: number;
}

/** A step under way, for the next one to cut in on. */
export interface RunningStep extends StepStart {
  direction: StepDirection;
  animations: Animation[];
}

/** Where content that started at `start` has got to, `progress` (0 to 1, eased) of the way. */
export function findStepPlace(start: StepStart, progress: number): StepStart {
  return {
    offsetPx: start.offsetPx * (1 - progress),
    opacity: start.opacity + (1 - start.opacity) * progress,
  };
}

/** A step covering `offsetPx`: the whole way takes a step's time, less in proportion. */
export function measureStepMs(offsetPx: number): number {
  return Math.max(MOTION_MS.stepShortest, (MOTION_MS.step * Math.abs(offsetPx)) / STEP_OFFSET_PX);
}

/** Where a running step's content is now, or null once it has landed. */
function readRunningPlace(step: RunningStep): StepStart | null {
  const [animation] = step.animations;
  if (!animation || animation.playState !== 'running') return null;
  const progress = animation.effect?.getComputedTiming().progress;
  return typeof progress === 'number' ? findStepPlace(step, progress) : null;
}

/** Screen pixels per pixel of the element's own, under any scale around it. */
function readScreenScale(element: HTMLElement): number {
  const width = element.offsetWidth;
  return width > 0 ? element.getBoundingClientRect().width / width : 1;
}

/**
 * Steps `elements` in from `direction`. A step the same way as `running` carries on from
 * where its content is, over the distance left; any other cancels it and starts fresh.
 * With `isSkimming` (stepping faster than a step takes), or reduced motion, nothing moves.
 * Returns the step, for the next one.
 */
export function stepIn(
  elements: HTMLElement[],
  direction: StepDirection,
  running: RunningStep | null,
  isSkimming: boolean
): RunningStep | null {
  const carried = running?.direction === direction ? readRunningPlace(running) : null;
  running?.animations.forEach((animation) => animation.cancel());
  if (isSkimming || prefersReducedMotion() || elements.length === 0) return null;
  const start = carried ?? {
    offsetPx: direction * STEP_OFFSET_PX,
    opacity: STEP_START_OPACITY,
  };
  const duration = carried ? measureStepMs(start.offsetPx) : MOTION_MS.step;
  const animations = elements.map((element) =>
    element.animate(
      [
        {
          transform: `translateX(${start.offsetPx / readScreenScale(element)}px)`,
          opacity: start.opacity,
        },
        { transform: 'none', opacity: 1 },
      ],
      { duration, easing: MOTION_EASE }
    )
  );
  return { ...start, direction, animations };
}

/** Marks put back once stepping slows fade in, rather than snap on. */
export function fadeMarksIn(marks: Iterable<Element>): void {
  if (prefersReducedMotion()) return;
  for (const mark of marks) {
    mark.animate([{ opacity: 0 }, { opacity: 1 }], { duration: MOTION_MS.marksBack });
  }
}
