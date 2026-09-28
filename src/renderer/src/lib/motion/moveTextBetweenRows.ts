import { MOTION_EASE, prefersReducedMotion } from './motionTiming';

const TRAVEL_MS = 260;
const FOLD_MS = 220;
const HEIGHT_MS = 200;
const EASE_IN = 'cubic-bezier(0.4, 0, 1, 1)';

/** The top of an element's first line: a wrapped inline span has a box per line. */
export function findFirstLineTop(element: Element | null): number | null {
  if (!element) return null;
  const lines = element.getClientRects();
  return (lines.length > 0 ? lines[0] : element.getBoundingClientRect()).top;
}

/** A row that came out of another's text starts there, faint, and settles into place. */
export function travelFrom(row: HTMLElement, fromTop: number): void {
  if (prefersReducedMotion()) return;
  const dy = fromTop - row.getBoundingClientRect().top;
  row.animate(
    [
      { transform: `translateY(${dy}px)`, opacity: 0.25 },
      { transform: 'none', opacity: 1 },
    ],
    { duration: TRAVEL_MS, easing: MOTION_EASE }
  );
}

/** A copy of a row that just left moves from where it was onto the line at `toTop`, fading. */
export function foldInto(box: HTMLElement, row: Element, rowRect: DOMRect, toTop: number): void {
  if (prefersReducedMotion()) return;
  const boxRect = box.getBoundingClientRect();
  const ghost = row.cloneNode(true) as HTMLElement;
  ghost.removeAttribute('data-sort-id');
  ghost.inert = true;
  Object.assign(ghost.style, {
    position: 'absolute',
    left: `${rowRect.left - boxRect.left}px`,
    top: `${rowRect.top - boxRect.top}px`,
    width: `${rowRect.width}px`,
    margin: '0',
    pointerEvents: 'none',
    zIndex: '3',
  });
  box.append(ghost);
  const fold = ghost.animate(
    [
      { transform: 'none', opacity: 1 },
      { opacity: 0.7, offset: 0.4 },
      { transform: `translateY(${toTop - rowRect.top}px)`, opacity: 0 },
    ],
    { duration: FOLD_MS, easing: EASE_IN }
  );
  const drop = () => ghost.remove();
  fold.addEventListener('finish', drop);
  fold.addEventListener('cancel', drop);
}

/**
 * Eases `box` from `fromPx` to its height now, once. Unlike `easeHeightChanges` it leaves
 * other changes alone: an editor growing as someone types must snap, or it lags the cursor.
 */
export function easeHeightFrom(box: HTMLElement, fromPx: number): void {
  const toPx = box.offsetHeight;
  if (prefersReducedMotion() || Math.abs(toPx - fromPx) < 2) return;
  box.style.overflow = 'clip';
  box.style.overflowClipMargin = '6px';
  const easing = box.animate([{ height: `${fromPx}px` }, { height: `${toPx}px` }], {
    duration: HEIGHT_MS,
    easing: MOTION_EASE,
  });
  const unclip = () => {
    box.style.overflow = '';
    box.style.overflowClipMargin = '';
  };
  easing.addEventListener('finish', unclip);
  easing.addEventListener('cancel', unclip);
}
