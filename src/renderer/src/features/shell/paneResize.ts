import type { PointerEvent as ReactPointerEvent } from 'react';
import { clampPaneWidth, type PaneWidthLimits } from '@/stores/uiStore';

interface PaneResize {
  /** Resized live during the drag, before the new width is stored. */
  pane: HTMLElement | null;
  /** The window edge the pane sits against; the handle is on its other side. */
  anchor: 'left' | 'right';
  limits: PaneWidthLimits;
  /** The width the drag ended at, in pixels. */
  onDone: (px: number) => void;
}

/** The CSS width a pane is drawn at: its own width, but never more than its share. */
export function formatPaneWidth(px: number, limits: PaneWidthLimits): string {
  return `max(${limits.minPx}px, min(${px}px, ${limits.maxShare * 100}vw))`;
}

/**
 * Drag a pane's inner edge to resize it. The width follows the pointer from where the drag
 * started, so grabbing the edge never makes the pane jump.
 */
export function startPaneResize(
  event: ReactPointerEvent,
  { pane, anchor, limits, onDone }: PaneResize
): void {
  // A double-click resets the width; that comes as its own event, not a drag.
  if (event.button !== 0 || event.detail > 1) return;
  event.preventDefault();
  const startX = event.clientX;
  const startPx = pane?.getBoundingClientRect().width ?? limits.defaultPx;
  const widthAt = (x: number) =>
    clampPaneWidth(startPx + (anchor === 'left' ? x - startX : startX - x), limits);

  let hasMoved = false;

  const onPointerMove = (move: PointerEvent) => {
    hasMoved = true;
    if (pane) pane.style.width = formatPaneWidth(widthAt(move.clientX), limits);
  };
  const onPointerUp = (up: PointerEvent) => {
    // Only a real drag is stored, so a click on the edge keeps the width as it was.
    if (hasMoved) onDone(widthAt(up.clientX));
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
