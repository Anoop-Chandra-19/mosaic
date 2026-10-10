import type { SnapshotFoldDays, SnapshotTrigger } from '@/types/history';

/*
 * The wording for when automatic snapshots happen and when they fold, shared by the history
 * bar's popover and Settings › History.
 */

export const SNAPSHOTS_INTRO =
  'Each template’s draft is saved as you type, so your work is safe without any of these. They only add rows to the history, as points to go back to.';

interface TriggerOption {
  trigger: SnapshotTrigger;
  label: string;
  description?: string;
}

/** "When you accept AI edits" stays out until the assistant can accept edits; it stays on. */
export const SNAPSHOT_TRIGGER_OPTIONS: TriggerOption[] = [
  {
    trigger: 'beforeRestore',
    label: 'Before you restore a version',
    description: 'Keeps the draft you replaced one click away.',
  },
  { trigger: 'onImport', label: 'When you import a file' },
  {
    trigger: 'whileWorking',
    label: 'While you work',
    description:
      'One version per editing session, with a revision each time you pause. A new version starts after 45 minutes without edits, or when you switch template or close the app.',
  },
];

export const FOLD_OPTIONS: { days: SnapshotFoldDays; label: string }[] = [
  { days: 30, label: 'After 30 days' },
  { days: 90, label: 'After 90 days' },
  { days: null, label: 'Never' },
];

export const HISTORY_TIPS_LABEL = 'Explain new kinds of rows';
export const HISTORY_TIPS_NOTE =
  'A short tip the first time each kind of row is on screen. Off stops new ones; seen ones stay seen.';

export const FOLD_NOTE =
  'Folded rows open in place. Named versions never fold. Nothing is deleted.';
