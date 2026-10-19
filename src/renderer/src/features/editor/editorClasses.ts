// Class strings several editor components share. Each is written out whole: Tailwind only
// generates classes it finds spelled out in the source.

/**
 * For controls that add or edit. Reading an older version lays it out in the editor, made
 * inert (`data-reading` on the editor's wrapper), and these go rather than sit there dead.
 * What only shows the version's state, such as an eye or a line's alignment, stays.
 */
export const HIDDEN_WHILE_READING = 'in-data-reading:hidden';

/** Where a row's ⋯ goes while the row is at rest and it isn't mounted: the same square. */
export const MENU_BUTTON_SPACE = 'block size-[1.625rem] shrink-0 in-data-reading:hidden';

// Focus reveals a row's controls only while moving by keyboard (`data-keyboard`, from
// `useKeyboardNavigationMark`), so mouse-restored focus cannot pin them open. Focused text
// fields still reveal them; each row also keeps its controls visible while its menu is
// open. Keep focus-within for reliable Tab handoffs between the controls.
export const EDITOR_CONTROL_REVEAL_CLASSES = {
  bullet:
    'invisible in-data-keyboard:group-focus-within/bullet:visible group-has-[input:focus,textarea:focus]/bullet:visible group-hover/bullet:visible',
  entry:
    'invisible in-data-keyboard:group-focus-within/entry:visible group-has-[input:focus,textarea:focus]/entry:visible group-hover/entry:visible',
  section:
    'invisible in-data-keyboard:group-focus-within/section:visible group-has-[input:focus,textarea:focus]/section:visible group-hover/section:visible',
};
