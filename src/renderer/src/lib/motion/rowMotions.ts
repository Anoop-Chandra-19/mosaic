import { MOTION_EASE, MOTION_EASE_IN, MOTION_MS, prefersReducedMotion } from './motionTiming';

/**
 * The motions a row in a list can make, each started in its box. All are tagged, so the next
 * change can finish them (`finishRowMotions`) and measure where things really are.
 */

const MOTION_ID = 'row-motion';

/** Where a row was in its box, and the row itself, which stays usable once it has left. */
export interface RowPlace {
  element: HTMLElement;
  top: number;
  left: number;
  width: number;
}

function tag(animation: Animation): Animation {
  animation.id = MOTION_ID;
  return animation;
}

export function listRowMotions(box: HTMLElement): Animation[] {
  return box.getAnimations({ subtree: true }).filter((animation) => animation.id === MOTION_ID);
}

export function finishRowMotions(box: HTMLElement): void {
  for (const animation of listRowMotions(box)) animation.finish();
}

/** The top of an element's first line: a wrapped inline span has a box per line. */
export function findFirstLineTop(element: Element | null): number | null {
  if (!element) return null;
  const lines = element.getClientRects();
  return (lines.length > 0 ? lines[0] : element.getBoundingClientRect()).top;
}

export function slideFrom(row: HTMLElement, dx: number, dy: number, delayMs = 0): void {
  if (prefersReducedMotion()) return;
  tag(
    row.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], {
      duration: MOTION_MS.slide,
      delay: delayMs,
      easing: MOTION_EASE,
      fill: 'backwards',
    })
  );
}

/** Fades in once its space has opened. */
export function appear(row: HTMLElement): void {
  if (prefersReducedMotion()) return;
  tag(
    row.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: MOTION_MS.appear,
      delay: MOTION_MS.appearDelay,
      easing: 'ease-out',
      fill: 'backwards',
    })
  );
}

/** A row that came out of another's text starts there, faint, and settles into place. */
export function travelFrom(row: HTMLElement, fromTop: number): void {
  if (prefersReducedMotion()) return;
  const dy = fromTop - row.getBoundingClientRect().top;
  tag(
    row.animate(
      [
        { transform: `translateY(${dy}px)`, opacity: 0.25 },
        { transform: 'none', opacity: 1 },
      ],
      { duration: MOTION_MS.travel, easing: MOTION_EASE }
    )
  );
}

/**
 * A new row keeps the info tint a moment, then lets it go: "this is the new one". It moves
 * nothing, so it stays with reduced motion.
 */
export function carryTint(target: Element): void {
  target.animate([{ backgroundColor: 'var(--info-soft)' }, { backgroundColor: 'transparent' }], {
    duration: MOTION_MS.carryTint,
    delay: MOTION_MS.carryTintDelay,
    easing: 'ease-out',
    fill: 'backwards',
  });
}

/** A change stepped to holds a highlight, then lets it go: "here it is". */
export function flashChange(target: Element): void {
  const highlight = 'oklch(0.93 0.13 95 / 70%)';
  target.animate(
    [
      { backgroundColor: highlight },
      { backgroundColor: highlight, offset: 0.3 },
      { backgroundColor: 'transparent' },
    ],
    { duration: MOTION_MS.changeFlash, easing: 'ease-out' }
  );
}

/** Puts a row that has left back where it was, over the list, for its way out. */
function drawLeftRow(box: HTMLElement, place: RowPlace, keyframes: Keyframe[], ms: number) {
  if (prefersReducedMotion()) return;
  const ghost = place.element;
  ghost.inert = true;
  Object.assign(ghost.style, {
    position: 'absolute',
    top: `${place.top}px`,
    left: `${place.left}px`,
    width: `${place.width}px`,
    margin: '0',
    pointerEvents: 'none',
    zIndex: '3',
  });
  box.append(ghost);
  const leaving = tag(
    ghost.animate(keyframes, { duration: ms, easing: MOTION_EASE_IN, fill: 'forwards' })
  );
  const drop = () => ghost.remove();
  leaving.addEventListener('finish', drop);
  leaving.addEventListener('cancel', drop);
}

export function leaveInPlace(box: HTMLElement, place: RowPlace): void {
  drawLeftRow(box, place, [{ opacity: 1 }, { opacity: 0 }], MOTION_MS.leave);
}

/** A row that has left moves onto the line at `toTop` (on screen) as it fades. */
export function foldOnto(box: HTMLElement, place: RowPlace, toTop: number): void {
  const dy = toTop - box.getBoundingClientRect().top - place.top;
  drawLeftRow(
    box,
    place,
    [
      { transform: 'none', opacity: 1 },
      { opacity: 0.7, offset: 0.4 },
      { transform: `translateY(${dy}px)`, opacity: 0 },
    ],
    MOTION_MS.fold
  );
}

/**
 * Eases `box` from `fromPx` to its height now, once. Unlike `easeHeightChanges` it leaves
 * other changes alone: an editor growing as someone types must snap, or it lags the cursor.
 */
export function easeHeightFrom(box: HTMLElement, fromPx: number, delayMs = 0): void {
  const toPx = box.offsetHeight;
  if (prefersReducedMotion() || Math.abs(toPx - fromPx) < 2) return;
  box.style.overflow = 'clip';
  box.style.overflowClipMargin = '6px';
  const easing = tag(
    box.animate([{ height: `${fromPx}px` }, { height: `${toPx}px` }], {
      duration: MOTION_MS.height,
      delay: delayMs,
      easing: MOTION_EASE,
      fill: 'backwards',
    })
  );
  const unclip = () => {
    box.style.overflow = '';
    box.style.overflowClipMargin = '';
  };
  easing.addEventListener('finish', unclip);
  easing.addEventListener('cancel', unclip);
}
