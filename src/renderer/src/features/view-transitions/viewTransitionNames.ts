/*
 * Every name the view-transition layer is joined by. viewTransitions.css spells the
 * same strings; a typo on either side fails silently (the transition is skipped, or runs
 * without its animation), so they are written here once and spread from here.
 */

/** `view-transition-name`s. */
export const TRANSITION_NAME = { page: 'paper', workspace: 'workspace' } as const;

/** `addTransitionType` values: a step between versions, the way time runs. */
export const TRANSITION_TYPE = { toOlder: 'to-older', toNewer: 'to-newer' } as const;

/** Classes React's <ViewTransition> gives a view's groups as it comes and goes. */
export const TRANSITION_CLASS = { surfaceIn: 'surface-in', surfaceOut: 'surface-out' } as const;

/** The box that shows the page, in the live preview and in the history view. */
export const PAGE_VIEWPORT = { 'data-page-viewport': '' } as const;

/** The history view's reading pane. */
export const HISTORY_READ = { 'data-history-read': '' } as const;

/** The workspace, and the view covering it, if any. */
export const workspaceMarks = (coveredBy: string | undefined) =>
  ({ 'data-workspace': '', 'data-covered-by': coveredBy }) as const;
