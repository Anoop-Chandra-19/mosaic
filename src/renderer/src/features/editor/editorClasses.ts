// Class strings several editor components share. Each is written out whole: Tailwind only
// generates classes it finds spelled out in the source.

/**
 * For controls that add or edit. Reading an older version lays it out in the editor, made
 * inert (`data-reading` on the editor's wrapper), and these go rather than sit there dead.
 * What only shows the version's state, such as an eye or a line's alignment, stays.
 */
export const HIDDEN_WHILE_READING = 'in-data-reading:hidden';
