import { scrollQuietly } from '@/lib/scrollbarReveal';

/*
 * How a view finds a step or a run among what it has drawn, to land on it: the conversation and
 * the Trace mark the same places the same way.
 */

export const runAnchorProps = (runId: number, callId: string | null = null) => ({
  'data-anchor-run': runId,
  'data-anchor-call': callId ?? undefined,
});

export function findRunAnchor(
  within: HTMLElement,
  runId: number,
  callId: string | null
): HTMLElement | null {
  const call =
    callId === null ? ':not([data-anchor-call])' : `[data-anchor-call="${CSS.escape(callId)}"]`;
  return within.querySelector<HTMLElement>(`[data-anchor-run="${runId}"]${call}`);
}

/** A view swap took the keyboard's place with it. Someone on the tabs stays there. */
export function moveKeyboardTo(element: HTMLElement) {
  if (document.activeElement?.getAttribute('role') !== 'tab') {
    element.focus({ preventScroll: true });
  }
}

/** Scrolls so the anchor sits this far below the top of the view. */
export function scrollToAnchor(scroller: HTMLElement, anchor: HTMLElement, belowTopPx: number) {
  const fromTop = anchor.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
  scrollQuietly(scroller, scroller.scrollTop + fromTop - belowTopPx);
}
