import { useEffect, useRef, useState } from 'react';
import { findAutoOpenAt, readFoldDelay, type RunState } from './runLineItems';

type AutoOpen = 'notYet' | 'open' | 'folded';

/**
 * Whether the line is open: the user's choice once they have made one. Until then, a long
 * run opens it in place while it works on its steps, and it folds once words take over or the
 * run ends. A run opens it once at most, and never while the model is writing: a line that
 * opens as the answer starts would only close again. A stop folds it at once.
 */
export function useRunLineOpen(
  stepStarts: readonly number[],
  { isRunning, isStopped }: RunState,
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
      readFoldDelay({ isRunning, isStopped }, Date.now() - openedAt.current)
    );
    return () => clearTimeout(timer);
  }, [isOnSteps, autoOpen, isRunning, isStopped]);

  return { isOpen: choice ?? autoOpen === 'open', setIsOpen: setChoice };
}
