/** Chromium exposes the transition running now; older engines don't, hence the fallback. */
type DocumentWithTransition = Document & { activeViewTransition?: ViewTransition | null };

const isTransitionPart = (animation: Animation) =>
  (animation.effect as KeyframeEffect | null)?.pseudoElement?.startsWith('::view-transition') ??
  false;

/**
 * Resolves once no view transition is running. Something painted over the app while one
 * runs lands in its before or after image and is painted again when it ends: a layer meant
 * to arrive after a view (a tour's veil) waits for this first.
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
