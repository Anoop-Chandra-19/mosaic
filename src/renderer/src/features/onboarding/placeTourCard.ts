import type { TourSide } from './tourSteps';

export interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

/** Room kept between the card and what it points at, and the window's edges. */
const GAP_PX = 14;
const OPPOSITE: Record<TourSide, TourSide> = {
  right: 'left',
  left: 'right',
  bottom: 'top',
  top: 'bottom',
};

/**
 * Where the card goes beside `target`, in window pixels. The preferred side if the card
 * fits there, else the opposite one; failing both, the other axis, else the roomier side.
 * Flipping comes before clamping: clamping alone would slide the card back over the very
 * thing it points at.
 */
export function placeTourCard(
  target: Box,
  side: TourSide,
  card: Size,
  window: Size
): { left: number; top: number } {
  const fits: Record<TourSide, boolean> = {
    right: target.left + target.width + GAP_PX + card.width <= window.width - GAP_PX,
    left: target.left - GAP_PX - card.width >= GAP_PX,
    bottom: target.top + target.height + GAP_PX + card.height <= window.height - GAP_PX,
    top: target.top - GAP_PX - card.height >= GAP_PX,
  };
  const isHorizontal = (s: TourSide) => s === 'left' || s === 'right';

  let placed = side;
  if (!fits[placed]) {
    const otherAxis: TourSide[] = isHorizontal(side) ? ['bottom', 'top'] : ['right', 'left'];
    if (fits[OPPOSITE[side]]) placed = OPPOSITE[side];
    else if (otherAxis.some((s) => fits[s])) placed = otherAxis.find((s) => fits[s])!;
    else if (isHorizontal(side)) {
      placed = target.left > window.width - target.left - target.width ? 'left' : 'right';
    } else {
      placed = target.top > window.height - target.top - target.height ? 'top' : 'bottom';
    }
  }

  const centeredLeft = target.left + target.width / 2 - card.width / 2;
  const position = {
    right: { left: target.left + target.width + GAP_PX, top: target.top },
    left: { left: target.left - card.width - GAP_PX, top: target.top + 8 },
    top: { left: centeredLeft, top: target.top - card.height - GAP_PX },
    bottom: { left: centeredLeft, top: target.top + target.height + GAP_PX },
  }[placed];

  return {
    left: Math.max(GAP_PX, Math.min(position.left, window.width - card.width - GAP_PX)),
    top: Math.max(GAP_PX, Math.min(position.top, window.height - card.height - GAP_PX)),
  };
}
