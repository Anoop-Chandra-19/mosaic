import { useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { prefersReducedMotion } from '@/lib/motion/motionTiming';
import { cn } from '@/lib/utils';

interface EditorFoldProps {
  isOpen: boolean;
  /** For the trigger's `aria-controls`. */
  id?: string;
  className?: string;
  children: ReactNode;
}

/**
 * Eases between no height and its own, and leaves the page once closed. Clips with room to
 * spare for an editor's ring and a row's hover fill.
 *
 * Plain CSS rather than Radix's collapsible content, which measures itself as it mounts: a
 * long resume mounts dozens of folds at once, and each measure forced a layout of its own.
 * A fold that mounts open doesn't ease in; one opened later grows from nothing.
 */
export function EditorFold({ isOpen, id, className, children }: EditorFoldProps) {
  const [shownOpen, setShownOpen] = useState(isOpen);
  const [hasToggled, setHasToggled] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  if (isOpen !== shownOpen) {
    setShownOpen(isOpen);
    setHasToggled(true);
    setIsClosing(!isOpen && !prefersReducedMotion());
  }
  if (!isOpen && !isClosing) return null;

  const finishClosing = (event: { target: EventTarget; currentTarget: EventTarget }) => {
    if (event.target === event.currentTarget && !isOpen) setIsClosing(false);
  };
  return (
    <div
      id={id}
      data-state={isOpen ? 'open' : 'closed'}
      inert={!isOpen}
      onTransitionEnd={finishClosing}
      onTransitionCancel={finishClosing}
      className={cn(
        'overflow-clip [overflow-clip-margin:0.375rem] [interpolate-size:allow-keywords] transition-[height] duration-200 ease-settle motion-reduce:transition-none',
        isOpen ? 'h-auto' : 'h-0',
        hasToggled && 'starting:h-0',
        className
      )}
    >
      {children}
    </div>
  );
}

/** Turns with the fold instead of swapping icons. */
export function FoldChevron({ isOpen }: { isOpen: boolean }) {
  return (
    <ChevronRight
      className={cn(
        'size-3 transition-transform duration-200 ease-settle motion-reduce:transition-none',
        isOpen && 'rotate-90'
      )}
    />
  );
}
