import { MOTION_EASE, prefersReducedMotion } from './motionTiming';

const EASE_MS = 200;

/** Something inside is already animating its height, such as a fold opening. */
function isGrowingOnItsOwn(box: HTMLElement): boolean {
  return box
    .getAnimations({ subtree: true })
    .some(
      (animation) =>
        animation.playState === 'running' &&
        animation.effect instanceof KeyframeEffect &&
        animation.effect.getKeyframes().some((frame) => 'height' in frame)
    );
}

interface Watch {
  observer: ResizeObserver;
  easing: Animation | null;
  /** Ref callbacks holding it; a component may detach and reattach its ref as it renders. */
  holders: number;
}

/**
 * One watch per box, kept across ref reattachments: a fresh one would measure the box after
 * the very change it should ease.
 */
const watches = new WeakMap<HTMLElement, Watch>();

function watchHeight(box: HTMLElement): Watch {
  let shownPx = box.offsetHeight;
  const watch: Watch = { observer: undefined!, easing: null, holders: 0 };
  watch.observer = new ResizeObserver(() => {
    // Our own easing resizes the box every frame; its end is where the next change starts.
    if (watch.easing) return;
    const fromPx = shownPx;
    const toPx = box.offsetHeight;
    shownPx = toPx;
    if (Math.abs(toPx - fromPx) < 2 || prefersReducedMotion() || isGrowingOnItsOwn(box)) {
      return;
    }
    const easing = box.animate([{ height: `${fromPx}px` }, { height: `${toPx}px` }], {
      duration: EASE_MS,
      easing: MOTION_EASE,
    });
    watch.easing = easing;
    const settle = () => (watch.easing = null);
    easing.addEventListener('finish', settle);
    easing.addEventListener('cancel', settle);
  });
  watch.observer.observe(box);
  return watch;
}

/**
 * A ref callback for a box whose height follows its content, such as a dialog: when the
 * content makes it jump, the height eases from the old size to the new one instead of
 * snapping. A change something inside already animates, like a fold, is left to it.
 * Nothing waits on the easing, so it never holds up input.
 */
export function easeHeightChanges(box: HTMLElement | null) {
  if (!box) return;
  let watch = watches.get(box);
  if (!watch) {
    watch = watchHeight(box);
    watches.set(box, watch);
  }
  watch.holders++;
  const held = watch;

  return () => {
    held.holders--;
    // A reattachment comes straight after the detachment, before this runs.
    queueMicrotask(() => {
      if (held.holders > 0) return;
      held.observer.disconnect();
      held.easing?.cancel();
      watches.delete(box);
    });
  };
}
