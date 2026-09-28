// Class strings several editor components share. Each is written out whole: Tailwind only
// generates classes it finds spelled out in the source.

/**
 * The editor's text fields, from the design's `.input`: sunken, a strong line, and an amber
 * ring while focused, in the design's amber rather than Tailwind's redder one.
 */
export const EDITOR_INPUT_CLASS =
  'rounded-md border-line-strong bg-pane-sunken shadow-none placeholder:text-ink-faint focus-visible:border-amber-line focus-visible:ring-[3px] focus-visible:ring-amber-soft dark:bg-pane-sunken';

/**
 * For controls that add or edit. Reading an older version lays it out in the editor, made
 * inert (`data-reading` on the editor's wrapper), and these go rather than sit there dead.
 * What only shows the version's state, such as an eye or a line's alignment, stays.
 */
export const HIDDEN_WHILE_READING = 'in-data-reading:hidden';
