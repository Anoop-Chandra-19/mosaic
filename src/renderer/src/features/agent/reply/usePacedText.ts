import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '@/lib/motion/motionTiming';
import { advancePace, cutAtWordEnd, MOST_BEHIND_MS, noteArrival, type TextPace } from './paceText';

/**
 * Reveals growing text on animation frames using the pace calculated by `paceText.ts`.
 * Shows the initial text immediately so stored replies do not replay the typing effect.
 * With reduced motion, reveals arriving text without the pacing delay.
 */
export function usePacedText(text: string): string {
  const [shown, setShown] = useState(text);
  const paceRef = useRef<TextPace>({ shownTo: text.length, charsPerMs: 0 });
  const tickedAtRef = useRef(0);

  useEffect(() => {
    const wasCaughtUp = paceRef.current.charsPerMs === 0;
    const mostBehindMs = prefersReducedMotion() ? 0 : MOST_BEHIND_MS;
    paceRef.current = noteArrival(paceRef.current, text.length, mostBehindMs);
    if (paceRef.current.charsPerMs === 0) return;
    if (wasCaughtUp) tickedAtRef.current = performance.now();

    const tick = (now: number) => {
      const elapsedMs = now - tickedAtRef.current;
      if (elapsedMs > 0) {
        tickedAtRef.current = now;
        paceRef.current = advancePace(paceRef.current, text.length, elapsedMs);
        setShown(cutAtWordEnd(text, paceRef.current.shownTo));
      }
      if (paceRef.current.charsPerMs > 0) frame = requestAnimationFrame(tick);
    };
    let frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [text]);

  // Show replacement text immediately when a retry changes the already-visible prefix.
  return text.startsWith(shown) ? shown : text;
}
