import { useEffect, useState } from 'react';
import type { Box } from './placeTourCard';

function isSameBox(a: Box | null, b: Box | null): boolean {
  if (!a || !b) return a === b;
  return a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height;
}

/**
 * Where the element `selector` finds is on screen, read every frame while a step shows it.
 * Panes slide, lists unfold and scroll, and windows resize under a tour step; no observer
 * catches an element that only moves, and one read a frame for a minute-long tour is
 * nothing. A target that scrolled out of its pane is brought into view once.
 */
export function useTargetRect(selector: string | null): Box | null {
  const [rect, setRect] = useState<Box | null>(null);

  useEffect(() => {
    let frame = 0;
    let scrolledTo: Element | null = null;
    const read = () => {
      const element = selector ? document.querySelector(selector) : null;
      if (element && element !== scrolledTo) {
        scrolledTo = element;
        element.scrollIntoView({ block: 'nearest' });
      }
      const box = element?.getBoundingClientRect();
      const next = box
        ? { top: box.top, left: box.left, width: box.width, height: box.height }
        : null;
      setRect((current) => (isSameBox(current, next) ? current : next));
      frame = requestAnimationFrame(read);
    };
    frame = requestAnimationFrame(read);
    return () => cancelAnimationFrame(frame);
  }, [selector]);

  return selector ? rect : null;
}
