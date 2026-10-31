import { cn } from '@/lib/utils';

/*
 * The one look of a diff, wherever it shows: removed text struck, added text highlighted. On the
 * resume page, black on white in both themes, the colours differ and its small type takes
 * thinner lines.
 */

export type DiffInk = 'app' | 'paper';

const SHAPE = {
  removed: 'line-through',
  added: 'rounded-[0.125rem] no-underline [box-decoration-break:clone]',
};

/**
 * In the app, tints go quiet while the history is skimming (`data-skimming`, a held key): marks
 * jumping many times a second strobe. They ease back when it stops.
 */
export const QUIET_WHILE_SKIMMING =
  'transition-[background-color] duration-120 in-data-skimming:bg-transparent motion-reduce:transition-none';

export const DIFF_MARKS: Record<DiffInk, { removed: string; added: string }> = {
  app: {
    removed: cn(SHAPE.removed, 'text-ink-muted decoration-del decoration-[1.5px]'),
    added: cn(
      SHAPE.added,
      'bg-add-soft shadow-[inset_0_-1.5px_0_var(--add-line)]',
      QUIET_WHILE_SKIMMING
    ),
  },
  paper: {
    removed: cn(SHAPE.removed, 'text-paper-del-text decoration-paper-del decoration-1'),
    added: cn(SHAPE.added, 'bg-paper-add-soft shadow-[inset_0_-1px_0_var(--paper-add)]'),
  },
};

/** A whole row that a suggestion adds or puts back, among rows that stay. */
export const ADDED_ROW = 'bg-add-soft shadow-[inset_2px_0_0_var(--add)]';
