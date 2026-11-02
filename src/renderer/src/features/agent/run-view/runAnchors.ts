import { scrollQuietly } from '@/lib/scrollbarReveal';

/*
 * Shared anchor attributes and navigation helpers for runs and tool calls. The conversation
 * and Trace use the same markers to find, focus, and scroll to corresponding entries.
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

/** Moves focus after a view switch, unless focus is on a tab. */
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
