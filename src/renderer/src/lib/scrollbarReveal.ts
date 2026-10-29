import { useEffect } from 'react';

/*
 * Scrollbars stay hidden until their own box scrolls, then show for a moment: only that
 * one, never every scrollbar in the window. A key that scrolls (an arrow, Page Down,
 * Space outside a text field) scrolls a box, which is what reveals it; typing never does.
 * A box the app moves on its own (`scrollQuietly`) keeps its bar hidden. The CSS is the
 * `data-scrollbar-active` rules in `index.css`.
 */

const IDLE_MS = 900;

const quietScrolls = new WeakSet<Element>();
const hideTimers = new WeakMap<Element, number>();

/** Scrolls `element` to `top` without showing its bar: the app moving it, not the user. */
export function scrollQuietly(element: HTMLElement, top: number): void {
  const reachable = Math.min(top, element.scrollHeight - element.clientHeight);
  if (Math.abs(element.scrollTop - reachable) < 1) return;
  quietScrolls.add(element);
  element.scrollTop = reachable;
}

function revealScrollbar(scroller: Element): void {
  scroller.setAttribute('data-scrollbar-active', 'true');
  window.clearTimeout(hideTimers.get(scroller));
  const hide = window.setTimeout(() => {
    scroller.removeAttribute('data-scrollbar-active');
    hideTimers.delete(scroller);
  }, IDLE_MS);
  hideTimers.set(scroller, hide);
}

function handleScroll(event: Event): void {
  const scroller = event.target instanceof Document ? event.target.documentElement : event.target;
  if (!(scroller instanceof Element) || quietScrolls.delete(scroller)) return;
  revealScrollbar(scroller);
}

/** The app runs this once. */
export function useScrollbarReveal(): void {
  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    return () => window.removeEventListener('scroll', handleScroll, { capture: true });
  }, []);
}
