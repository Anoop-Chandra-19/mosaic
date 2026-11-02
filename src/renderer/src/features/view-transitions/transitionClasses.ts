// Components use these classes to join the animations in viewTransitions.css.
// Keep class strings complete so Tailwind can find and generate them.

const NAME_CLASS = {
  page: '[view-transition-name:page]',
  workspace: '[view-transition-name:workspace]',
  'history-list': '[view-transition-name:history-list]',
  'tour-overlay': '[view-transition-name:tour-overlay]',
  bar: '[view-transition-name:bar]',
  assist: '[view-transition-name:assist]',
  sidebar: '[view-transition-name:sidebar]',
  'preview-bar-start': '[view-transition-name:preview-bar-start]',
  'preview-bar-end': '[view-transition-name:preview-bar-end]',
  applybar: '[view-transition-name:applybar]',
} as const;

// Combined motions need one class that sets the full list; separate classes would overwrite it.
const MOTION_CLASS = {
  recede: '[view-transition-class:recede]',
  handoff: '[view-transition-class:handoff]',
  'handoff step': '[view-transition-class:handoff_step]',
  // Move the existing content without cross-fading two copies.
  'handoff in-place': '[view-transition-class:handoff_in-place]',
  reclaim: '[view-transition-class:reclaim]',
  fade: '[view-transition-class:fade]',
  'slide-away slide-in': '[view-transition-class:slide-away_slide-in]',
  lockstep: '[view-transition-class:lockstep]',
  // Move without stretching the content; at-end keeps it aligned to the right edge.
  glide: '[view-transition-class:glide]',
  'glide at-end': '[view-transition-class:glide_at-end]',
  // Swap the assistant pane and review inspector with a vertical push.
  'handover-upper': '[view-transition-class:handover_upper]',
  'handover-lower': '[view-transition-class:handover_lower]',
  // Bring the apply bar up after a short delay; move it down when closing.
  rise: '[view-transition-class:rise]',
} as const;

// Passed to React's <ViewTransition enter exit> for mounting and unmounting views.
export const SURFACE_MOTION = { in: 'surface-in', out: 'surface-out' } as const;
/** No animation on the view itself; its parts animate separately. */
export const CUT_MOTION = 'cut';
/** Slide a panel in or out at the left (start) or right (end) edge. */
export const SLIDE_AWAY_MOTION = {
  start: { in: 'slide-in', out: 'slide-away' },
  end: { in: 'slide-in at-end', out: 'slide-away at-end' },
} as const;

/** Animation options passed to React's addTransitionType or changeInViewTransition. */
export const TRANSITION_TYPE = {
  stepBack: 'step-back',
  stepForward: 'step-forward',
  /** Cross-fade the UI before and after an update. */
  crossfade: 'crossfade',
} as const;

/**
 * Returns classes that identify an element (`name`) and its animation (`motion`).
 * Set `isActive` to false to opt out. Only one rendered element may use each name,
 * or the browser skips the transition.
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
