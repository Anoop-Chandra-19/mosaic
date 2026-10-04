import { useEffect } from 'react';

/**
 * While a menu or select is open, the page under it ignores the pointer, so a quick second
 * click lands on the bare document and the browser selects the words beneath it: a
 * double-click on a bullet's menu button selected the bullet's text. Nothing on the bare
 * document is worth selecting, so its repeat clicks select nothing.
 */
export function useNoSelectionBehindLayers() {
  useEffect(() => {
    const ignoreRepeatClick = (event: MouseEvent) => {
      if (event.detail > 1 && event.target === document.documentElement) event.preventDefault();
    };
    document.addEventListener('mousedown', ignoreRepeatClick, true);
    return () => document.removeEventListener('mousedown', ignoreRepeatClick, true);
  }, []);
}
