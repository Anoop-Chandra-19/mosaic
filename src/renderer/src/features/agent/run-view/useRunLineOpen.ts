import { useEffect, useRef, useState } from 'react';
import { findAutoOpenAt, readFoldDelay, type RunState } from './runTimeline';

type AutoOpen = 'notYet' | 'open' | 'folded';

/**
 * Controls a line's open state. An explicit user choice overrides automatic behavior.
 * Otherwise, opens at most once while steps are running and folds after reply text starts
 * or the run ends. Never opens automatically during reply text, which would immediately
 * trigger folding. A stopped run skips the folding delay.
 */
export function useRunLineOpen(
  stepStarts: readonly number[],
  { isRunning, isStopped, isCancelled }: RunState,
  isWritingWords: boolean
): { isOpen: boolean; setIsOpen: (isOpen: boolean) => void } {
  const [choice, setChoice] = useState<boolean | null>(null);
  const [autoOpen, setAutoOpen] = useState<AutoOpen>('notYet');
  const openedAt = useRef(0);
  const autoOpenAt = findAutoOpenAt(stepStarts);
  const isOnSteps = isRunning && !isWritingWords;

  useEffect(() => {
    if (!isOnSteps || autoOpen !== 'notYet' || autoOpenAt === null) return;
    const timer = setTimeout(
      () => {
        openedAt.current = Date.now();
        setAutoOpen('open');
      },
      Math.max(0, autoOpenAt - Date.now())
    );
    return () => clearTimeout(timer);
  }, [isOnSteps, autoOpen, autoOpenAt]);

  useEffect(() => {
    if (isOnSteps || autoOpen !== 'open') return;
    const timer = setTimeout(
      () => setAutoOpen('folded'),
      readFoldDelay({ isRunning, isStopped, isCancelled }, Date.now() - openedAt.current)
    );
    return () => clearTimeout(timer);
  }, [isOnSteps, autoOpen, isRunning, isStopped, isCancelled]);

  return { isOpen: choice ?? autoOpen === 'open', setIsOpen: setChoice };
}
