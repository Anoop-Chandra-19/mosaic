// Older browsers need the animation-list fallback below.
type DocumentWithTransition = Document & { activeViewTransition?: ViewTransition | null };

const isTransitionPart = (animation: Animation) =>
  (animation.effect as KeyframeEffect | null)?.pseudoElement?.startsWith('::view-transition') ??
  false;

/**
 * Waits for the current view transition to finish, even if it is cancelled.
 * Does not wait for future transitions. Used to delay overlays and clean up after closing.
 */
export async function whenViewTransitionsSettle(): Promise<void> {
  const active = (document as DocumentWithTransition).activeViewTransition;
  const finishing = active
    ? [active.finished]
    : document
        .getAnimations()
        .filter(isTransitionPart)
        .map((animation) => animation.finished);
  await Promise.allSettled(finishing);
}
