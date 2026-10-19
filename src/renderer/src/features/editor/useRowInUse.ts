import { useState, type FocusEvent } from 'react';

/**
 * Whether an editor row is in use: the pointer or focus is in it, or `isHeld` (its menu is
 * showing, or it is being dragged). A row mounts its grip and menu only then. At rest they
 * are invisible anyway, and on a long resume they were most of what the editor mounted.
 */
export function useRowInUse(isHeld: boolean) {
  const [isPointerIn, setIsPointerIn] = useState(false);
  const [isFocusIn, setIsFocusIn] = useState(false);

  return {
    isInUse: isPointerIn || isFocusIn || isHeld,
    rowProps: {
      onPointerEnter: () => setIsPointerIn(true),
      onPointerLeave: () => setIsPointerIn(false),
      onFocus: () => setIsFocusIn(true),
      onBlur: (event: FocusEvent) => {
        const next = event.relatedTarget;
        if (!(next instanceof Node) || !event.currentTarget.contains(next)) setIsFocusIn(false);
      },
    },
  };
}
