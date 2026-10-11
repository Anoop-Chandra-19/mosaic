// Whole class strings, not built from parts: Tailwind only generates classes it finds
// spelled out in the source.

const NAME_CLASS = {
  page: '[view-transition-name:page]',
  workspace: '[view-transition-name:workspace]',
  'history-list': '[view-transition-name:history-list]',
  'tour-overlay': '[view-transition-name:tour-overlay]',
  bar: '[view-transition-name:bar]',
  assist: '[view-transition-name:assist]',
  sidebar: '[view-transition-name:sidebar]',
  applybar: '[view-transition-name:applybar]',
} as const;

// An element has one view-transition-class list, so motions that go together are one entry.
const MOTION_CLASS = {
  recede: '[view-transition-class:recede]',
  handoff: '[view-transition-class:handoff]',
  'handoff step': '[view-transition-class:handoff_step]',
  reclaim: '[view-transition-class:reclaim]',
  fade: '[view-transition-class:fade]',
  'slide-away slide-in': '[view-transition-class:slide-away_slide-in]',
  lockstep: '[view-transition-class:lockstep]',
  // A stack of two in one box: the upper leaves up as the lower rises in, and back down.
  'handover-upper': '[view-transition-class:handover_upper]',
  'handover-lower': '[view-transition-class:handover_lower]',
  // Comes in at the bottom once what it sits on has nearly landed, and sinks away.
  rise: '[view-transition-class:rise]',
} as const;

// Classes for React's <ViewTransition enter exit>, for things that come and go.
export const SURFACE_MOTION = { in: 'surface-in', out: 'surface-out' } as const;
/** A surface whose parts all move on their own: what's left of it just appears and goes. */
export const CUT_MOTION = 'cut';
export const SLIDE_AWAY_MOTION = { in: 'slide-in', out: 'slide-away' } as const;

/** Directions for `addTransitionType`. */
export const TRANSITION_TYPE = {
  stepBack: 'step-back',
  stepForward: 'step-forward',
  /** The whole page fades from before to after: `changeInViewTransition`. */
  crossfade: 'crossfade',
} as const;

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
