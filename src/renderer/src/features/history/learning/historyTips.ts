import type { HistoryTipId, SnapshotFoldDays } from '@/types/history';
import type { VersionMeta, VersionSource } from '@shared/types/db';
import type { HistoryItem } from '../groupVersionHistory';
import { versionLabel } from '../useTemplateVersions';

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

const labelOf = (item: HistoryItem) => {
  const newest = newestOf(item);
  return newest ? versionLabel(newest) : '';
};

/** First match wins, so the order is how basic the idea is. */
export const HISTORY_TIPS: readonly HistoryTip[] = [
  {
    id: 'auto',
    title: 'An automatic snapshot',
    matches: (item) => isAutomatic(singleVersion(item), ['edit']),
    body: () =>
      'The tick is a snapshot Mosaic took on its own, at a moment set in History settings. Your draft is saved as you type either way.',
  },
  {
    id: 'named',
    title: 'A version you named',
    matches: (item) => newestOf(item)?.kind === 'named',
    body: (item) =>
      `The diamond marks ${labelOf(item)}, a version you named. Named versions are kept for good, and they are what the index lists.`,
  },
  {
    id: 'rev',
    title: 'A version with revisions',
    matches: (item) =>
      item.kind === 'number' &&
      item.revisions.length > 1 &&
      item.revisions[0].kind === 'auto' &&
      item.revisions[0].source !== 'assistant',
    body: (item) => {
      const label = labelOf(item);
      return `${label.split('.')[0]} is one editing session. Each pause added a revision, and the row shows the newest, ${label}. “earlier” opens the rest. Labels never change.`;
    },
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
