import { cn } from '@/lib/utils';

/*
 * The one look of a diff, wherever it shows: removed text struck, added text highlighted.
 */

/**
 * Tints go quiet while the history is skimming (`data-skimming`, a held key): marks jumping
 * many times a second strobe. They ease back when it stops.
 */
export const QUIET_WHILE_SKIMMING =
  'transition-[background-color] duration-120 in-data-skimming:bg-transparent motion-reduce:transition-none';

export const DIFF_MARKS = {
  removed: 'text-ink-muted line-through decoration-del decoration-[length:var(--diff-line,1.5px)]',
  added: cn(
    'rounded-[0.125rem] bg-add-soft no-underline [box-decoration-break:clone]',
    'shadow-[inset_0_calc(var(--diff-line,1.5px)*-1)_0_var(--add-line)]',
    QUIET_WHILE_SKIMMING
  ),
};

/**
 * The same marks on the resume page, black on white in both themes: colours that don't change
 * with the theme, and thinner lines for its small type. Set on an element around the marks.
 */
export const PAPER_INK =
  '[--add-line:var(--paper-add)] [--add-soft:var(--paper-add-soft)] [--del:var(--paper-del)] [--diff-line:1px] [--ink-muted:var(--paper-del-text)]';

/** A whole row that a suggestion adds or puts back, among rows that stay. */
export const ADDED_ROW = 'bg-add-soft shadow-[inset_2px_0_0_var(--add)]';
