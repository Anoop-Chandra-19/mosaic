import type { HistoryTipId, SnapshotFoldDays } from '@/types/history';
import type { VersionMeta, VersionSource } from '@shared/types/db';
import type { HistoryItem } from '../groupVersionHistory';

/*
 * Learning the history: each kind of row is explained the first time it is on screen, one
 * tip per open, in the user's own history. The tips live here; the tour that explains all
 * of them at once is onboarding's.
 *
 * Path: `useHistoryTip` finds the rows fully in view once the list settles, asks
 * `chooseHistoryTip` which one to explain against this table, and counts the showing;
 * `HistoryTip` draws it. The version list uses `useHistoryTip` and `HistoryTip`.
 */

export interface HistoryTipContext {
  foldDays: SnapshotFoldDays;
}

export interface HistoryTip {
  id: HistoryTipId;
  title: string;
  body: (item: HistoryItem, context: HistoryTipContext) => string;
  matches: (item: HistoryItem) => boolean;
  /** Whether it can show at all with these settings. */
  applies?: (context: HistoryTipContext) => boolean;
}

/** A row standing for one version: a number with no earlier revisions. */
function singleVersion(item: HistoryItem): VersionMeta | null {
  return item.kind === 'number' && item.revisions.length === 1 ? item.revisions[0] : null;
}

function newestOf(item: HistoryItem): VersionMeta | null {
  return item.kind === 'number' ? item.revisions[0] : null;
}

const isAutomatic = (version: VersionMeta | null, sources: readonly VersionSource[]) =>
  version !== null && version.kind === 'auto' && sources.includes(version.source);

/** The hollow square's words fit these; "Created", "copy" and "Restored" carry tags instead. */
const KEPT_BEFORE: readonly VersionSource[] = [
  'import',
  'before-import',
  'before-restore',
  'before-apply',
];

/*
 * The words explain the kind of row, never the row: its label is on screen beside the tip,
 * and an explanation built around one example reads as a rule about that example.
 */

/** First match wins, so the order is how basic the idea is. */
export const HISTORY_TIPS: readonly HistoryTip[] = [
  {
    id: 'auto',
    title: 'A copy Mosaic kept',
    matches: (item) => isAutomatic(singleVersion(item), ['edit']),
    body: () =>
      'Besides the versions you name, Mosaic keeps copies of your resume on its own, at moments you choose in History settings. You can read or restore one like any version. Your draft is saved as you type either way, so these are extra places to go back to.',
  },
  {
    id: 'named',
    title: 'A version you named',
    matches: (item) => newestOf(item)?.kind === 'named',
    body: () =>
      'The diamond marks a version you named. Named versions are kept for good, and they are what the index lists.',
  },
  {
    id: 'rev',
    title: 'One sitting of editing',
    matches: (item) =>
      item.kind === 'number' &&
      item.revisions.length > 1 &&
      item.revisions[0].kind === 'auto' &&
      item.revisions[0].source !== 'assistant',
    body: () =>
      'While you edit, Mosaic keeps a copy two minutes after your last change. All the copies from one sitting share one version number, and each is a revision of it, labelled with a dot after the number. The row shows the newest revision; “earlier” lists the rest. A new number starts when you come back after 45 minutes, switch template, or close the app.',
  },
  {
    id: 'event',
    title: 'Kept before a change',
    matches: (item) => isAutomatic(singleVersion(item), KEPT_BEFORE),
    body: () =>
      'The hollow square marks an import, or your draft kept just before a restore or an apply, so you can always go back.',
  },
  {
    id: 'ai',
    title: 'Suggestions you applied',
    matches: (item) => isAutomatic(newestOf(item), ['assistant']),
    body: () =>
      'The spark marks assistant suggestions you applied. The row holds only what landed, never what you dropped.',
  },
  {
    id: 'stop',
    title: 'Where you left it',
    matches: (item) => isAutomatic(singleVersion(item), ['switched', 'closed']),
    body: () =>
      'The filled square is your draft as it was when you switched template or closed the app.',
  },
  {
    id: 'fold',
    title: 'Older snapshots, folded',
    matches: (item) => item.kind === 'fold',
    applies: ({ foldDays }) => foldDays !== null,
    body: (_item, { foldDays }) =>
      `Automatic snapshots older than ${foldDays} days fold into one row between named versions. Open it to see them all. Nothing is deleted. Change this in History settings.`,
  },
];
