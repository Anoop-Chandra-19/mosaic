import type { HistoryTipId } from '@/types/history';
import type { TourSide } from '../placeTourCard';
import type { TourTarget } from '../tourTargets';

/*
 * The history tour: six stops over the full history, always on its example history, so it
 * never depends on what someone's own history holds. The words explain how history works,
 * never the example's rows: their labels are on screen, and an explanation built around one
 * example reads as a rule about that example.
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
      'Your draft is what you see in the editor, saved as you type. This list holds versions: copies you can read and go back to, newest at the top. You make one by naming it. Mosaic keeps others on its own at moments you choose in History settings: before a restore or an import, and while you edit if you turn that on.'
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
    title: fixed('One number per sitting'),
    body: fixed(
      'When Mosaic keeps copies while you edit, all the copies from one sitting share a version number, and each is a revision of it. The row shows the newest revision; “earlier” opens the rest. Labels never change, so a label always means the same page.'
    ),
  },
  {
    id: 'read',
    target: 'historyCompare',
    side: 'bottom',
    title: fixed('Read before you restore'),
    body: fixed(
      'Click any row to read it here. “Changes in” shows what one version did. On a number with revisions, “All of” shows the whole sitting. “Against your draft” shows what Restore would do. Green is on this page, struck red is on the other side.'
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
        ? 'Restore makes the version you are reading your draft again. The draft you have now is kept first, as a “Before restoring” row, so you can always come back.'
        : 'Restore makes the version you are reading your draft again. “Before you restore a version” is off in History settings, so the draft you have now gets no row. Name it first if you want to keep it.',
  },
  {
    id: 'settings',
    target: 'historySettings',
    side: 'bottom',
    title: fixed('You decide what gets a row'),
    body: fixed(
      'Simple or All details, the moments Mosaic keeps a copy on its own, and when old ones fold. This tour lives here too.'
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
