// Whole class strings, not built from parts: Tailwind only generates classes it finds
// spelled out in the source.

const NAME_CLASS = {
  page: '[view-transition-name:page]',
  workspace: '[view-transition-name:workspace]',
} as const;

// An element has one view-transition-class list, so motions that go together are one entry.
const MOTION_CLASS = {
  recede: '[view-transition-class:recede]',
  handoff: '[view-transition-class:handoff]',
  'handoff step': '[view-transition-class:handoff_step]',
} as const;

/** Classes React's <ViewTransition> gives a view as it comes and goes. */
export const SURFACE_MOTION = { in: 'surface-in', out: 'surface-out' } as const;

/** Directions for `addTransitionType`. */
export const TRANSITION_TYPE = { stepBack: 'step-back', stepForward: 'step-forward' } as const;

/**
 * Puts an element in a view transition. Of two elements sharing a name, only the active
 * one may hold it, or the browser skips the transition.
 */
export function transitionClasses({
  name,
  motion,
  isActive = true,
}: {
  name: keyof typeof NAME_CLASS;
  motion: keyof typeof MOTION_CLASS;
  isActive?: boolean;
}): string {
  return isActive ? `${NAME_CLASS[name]} ${MOTION_CLASS[motion]}` : '';
}
