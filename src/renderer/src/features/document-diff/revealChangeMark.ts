import { prefersReducedMotion } from '@/lib/motion/motionTiming';
import { flashChange } from '@/lib/motion/rowMotions';
import type { Change } from '@shared/resume/changes/resumeChange';

/** The change's mark on the page or in a list: not the preview's offscreen copy. */
function findChangeMark(container: HTMLElement | null, change: Change): Element | undefined {
  const marks = container?.querySelectorAll(`[data-change-id="${CSS.escape(change.id)}"]`) ?? [];
  return [...marks].find((mark) => !mark.closest('[data-preview-measure]'));
}

/** Scrolls the change's mark into view inside `container` and flashes it. */
export function revealChangeMark(container: HTMLElement | null, change: Change): void {
  const mark = findChangeMark(container, change);
  if (!mark) return;
  mark.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  flashChange(mark);
}
