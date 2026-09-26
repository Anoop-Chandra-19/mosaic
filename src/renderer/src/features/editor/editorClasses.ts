// Class strings several editor components share. Each is written out whole: Tailwind only
// generates classes it finds spelled out in the source.

/**
 * The editor's text fields, from the design's `.input`: sunken, a strong line, and an amber
 * ring while focused. Solid amber steps stand in for the design's translucent ring.
 */
export const EDITOR_INPUT_CLASS =
  'rounded-md border-line-strong bg-pane-sunken shadow-none placeholder:text-ink-faint focus-visible:border-amber-300 focus-visible:ring-[3px] focus-visible:ring-amber-100 dark:bg-pane-sunken dark:focus-visible:border-amber-800 dark:focus-visible:ring-amber-950';

/**
 * For controls that add or edit. Reading an older version lays it out in the editor, made
 * inert (`data-reading` on the editor's wrapper), and these go rather than sit there dead.
 * What only shows the version's state, such as an eye or a line's alignment, stays.
 */
export const HIDDEN_WHILE_READING = 'in-data-reading:hidden';
