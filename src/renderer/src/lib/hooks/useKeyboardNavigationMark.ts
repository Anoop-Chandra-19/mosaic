import { useEffect } from 'react';

/*
 * Whether someone is moving through the app by keyboard, marked on <html> as
 * `data-keyboard`, so controls revealed by focus (`in-data-keyboard:group-focus-within:…`)
 * stay hidden for a mouse. Radix puts focus back on a menu's trigger when it closes; read
 * as plain focus, that would pin a row's controls open after every click.
 *
 * Marked as the key goes down, before focus moves: a CSS `:focus-visible` reveal can hide
 * its target during Tab's focus handoff in Chromium, and portalled menus are covered too.
 */

const isNavigationKey = (event: KeyboardEvent) =>
  event.key === 'Tab' || event.key.startsWith('Arrow');

/** Keeps the mark for the whole app. The shell runs it once. */
export function useKeyboardNavigationMark(): void {
  useEffect(() => {
    const root = document.documentElement;
    const onKeyDown = (event: KeyboardEvent) => {
      if (isNavigationKey(event)) root.dataset.keyboard = '';
    };
    const onPointerDown = () => delete root.dataset.keyboard;
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('pointerdown', onPointerDown, true);
      delete root.dataset.keyboard;
    };
  }, []);
}
