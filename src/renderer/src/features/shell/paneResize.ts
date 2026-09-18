import type { PointerEvent as ReactPointerEvent } from 'react';

interface PaneResize {
  /** Resized live during the drag, before the new width is stored. */
  pane: HTMLElement | null;
  /** The window edge the pane sits against; the handle is on its other side. */
  anchor: 'left' | 'right';
  minPx: number;
  maxRatio: number;
  /** The width the drag ended at, as a share of the window. */
  onDone: (ratio: number) => void;
}

/**
 * Drag a pane's inner edge to resize it. Widths are kept as a share of the window, with a
 * pixel floor, so a pane scales with the window instead of pinning a fixed size.
 */
export function startPaneResize(
  event: ReactPointerEvent,
  { pane, anchor, minPx, maxRatio, onDone }: PaneResize
): void {
  event.preventDefault();
  const ratioAt = (x: number) => {
    const width = window.innerWidth;
    const px = anchor === 'left' ? x : width - x;
    return Math.min(maxRatio, Math.max(minPx, px) / width);
  };

  const onPointerMove = (move: PointerEvent) => {
    if (pane) pane.style.width = `${ratioAt(move.clientX) * 100}vw`;
  };
  const onPointerUp = (up: PointerEvent) => {
    onDone(ratioAt(up.clientX));
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };

  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', onPointerUp);
}
