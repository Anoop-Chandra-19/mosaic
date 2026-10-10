import type { HistoryTipId } from '@/types/history';
import type { TourSide } from '../placeTourCard';
import type { TourTarget } from '../tourTargets';

/*
 * The history tour: six stops over the full history, always on its example history, so it
 * never depends on what someone's own history holds. The example reads the editing session
 * v11, closed by v11.3 just before an apply, so the stops can name them.
 */

/** What a stop's words depend on: the user's own settings. */
export interface HistoryTourContext {
  /** "Before you restore a version" is on, so a restore keeps the draft it replaces. */
  isRestoreKept: boolean;
}

export interface HistoryTourStep {
  id: string;
  /** None: the card sits in the middle of the window. */
  target?: TourTarget;
  side?: TourSide;
  title: (context: HistoryTourContext) => string;
  body: (context: HistoryTourContext) => string;
  /** The marks and what each means, under the body. */
  hasLegend?: true;
}

const fixed = (text: string) => () => text;

export const HISTORY_TOUR_STEPS: readonly HistoryTourStep[] = [
  {
    id: 'intro',
    title: fixed('How history works'),
    body: fixed(
      'Six stops, about a minute. This runs on an example history with every kind of row in it, so nothing is missing. Your own versions are untouched.'
    ),
  },
  {
    id: 'list',
    target: 'historyList',
    side: 'right',
    title: fixed('Your draft, and its versions'),
    body: fixed(
      'Your draft is what you see in the editor. It is saved as you type, always. This list holds versions: points you can read and go back to, newest at the top.'
    ),
  },
  {
    id: 'marks',
    target: 'namedVersion',
    side: 'right',
    title: fixed('What the marks mean'),
    body: fixed('Bold rows are versions you named. Dim ones Mosaic kept on its own.'),
    hasLegend: true,
  },
  {
    id: 'revisions',
    target: 'readVersion',
    side: 'right',
    title: fixed('One number per piece of work'),
    body: fixed(
      'v11 is one editing session. Each pause added a revision, up to v11.3, and the row shows the newest. “earlier” opens the rest. Labels never change, so v11 always means the same page.'
    ),
  },
  {
    id: 'read',
    target: 'historyCompare',
    side: 'bottom',
    title: fixed('Read before you restore'),
    body: fixed(
      'Click any row to read it here. “Changes in v11.3” shows what that one did. On a number with revisions, “All of v11” shows the whole session. “Against your draft” shows what Restore would do. Green is on this page, struck red is on the other side.'
    ),
  },
  {
    id: 'restore',
    target: 'historyRestore',
    side: 'bottom',
    title: ({ isRestoreKept }) =>
      isRestoreKept ? 'Restoring loses nothing' : 'Restoring replaces your draft',
    body: ({ isRestoreKept }) =>
      isRestoreKept
        ? 'Restore makes v11.3 your draft again. The draft you have now is kept first, as a “Before restoring” row, so you can always come back.'
        : 'Restore makes v11.3 your draft again. “Before you restore a version” is off in History settings, so the draft you have now gets no row. Name it first if you want to keep it.',
  },
  {
    id: 'settings',
    target: 'historySettings',
    side: 'bottom',
    title: fixed('You decide what gets a row'),
    body: fixed(
      'Simple or All details, which moments take an automatic snapshot, and when old ones fold. This tour lives here too.'
    ),
  },
];

/** Finishing the tour explains these; folding has no stop, so its tip still comes later. */
export const HISTORY_TOUR_EXPLAINS: readonly HistoryTipId[] = [
  'auto',
  'named',
  'rev',
  'event',
  'ai',
  'stop',
];
