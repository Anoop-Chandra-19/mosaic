import { prefersReducedMotion } from '@/lib/motion/motionTiming';
import { flashChange } from '@/lib/motion/rowMotions';
import type { Change } from '@shared/resume/changes/resumeChange';

/** Room left of a mark scrolled to sideways, so its line starts clear of the edge. */
const SIDEWAYS_MARGIN_PX = 24;
/** How much of a wide mark must show for it to count as in view sideways. */
const SHOWN_WIDTH_SHARE = 0.6;

/** The change's mark on the page or in a list: not the preview's offscreen copy. */
function findChangeMark(container: HTMLElement | null, change: Change): Element | undefined {
  const marks = container?.querySelectorAll(`[data-change-id="${CSS.escape(change.id)}"]`) ?? [];
  return [...marks].find((mark) => !mark.closest('[data-preview-measure]'));
}

/**
 * Where `scroller` goes to show `mark`: centred top to bottom, and sideways only when its
 * start, or most of it, is out of view, then to its start.
 */
function measureScrollTo(scroller: HTMLElement, mark: Element): ScrollToOptions {
  const box = mark.getBoundingClientRect();
  const view = scroller.getBoundingClientRect();
  const top = scroller.scrollTop + box.top - view.top - (view.height - box.height) / 2;
  const shownWidth = Math.min(box.width, view.width * SHOWN_WIDTH_SHARE);
  const isInViewSideways = box.left >= view.left && box.left + shownWidth <= view.right;
  const left = isInViewSideways
    ? scroller.scrollLeft
    : scroller.scrollLeft + box.left - view.left - SIDEWAYS_MARGIN_PX;
  return { top: Math.max(0, top), left: Math.max(0, left) };
}

/** Scrolls `scroller` to the change's mark, at the zoom it is at, and flashes it. */
export function revealChangeMark(scroller: HTMLElement | null, change: Change): void {
  const mark = findChangeMark(scroller, change);
  if (!scroller || !mark) return;
  scroller.scrollTo({
    ...measureScrollTo(scroller, mark),
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
  });
  flashChange(mark);
}
