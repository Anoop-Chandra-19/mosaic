import { useState } from 'react';

/** Keep row controls reachable through Radix's closing animation and focus restoration. */
export function useEditorMenu() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMenuVisible, setIsMenuVisible] = useState(false);

  const setMenuOpen = (isOpen: boolean) => {
    setIsMenuOpen(isOpen);
    if (isOpen) setIsMenuVisible(true);
  };

  // Radix restores focus after this callback. React batches this update, so the trigger
  // is still visible for that handoff; keyboard focus then keeps its controls revealed.
  const finishMenuClose = () => {
    if (!isMenuOpen) setIsMenuVisible(false);
  };

  return { isMenuOpen, isMenuVisible, setMenuOpen, finishMenuClose };
}
