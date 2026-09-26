import type { SidebarTab } from '@/stores/uiStore';

/** The elements the tour points at, each marked with `tourTargetProps` where it renders. */
export const TOUR_TARGET = {
  content: 'content',
  preview: 'preview',
  history: 'history',
  nameVersion: 'name-version',
  templates: 'templates',
  export: 'export',
  contentTab: 'content-tab',
  templatesTab: 'templates-tab',
} as const;

export type TourTarget = keyof typeof TOUR_TARGET;

/** Where the spotlight goes on its way to a step on another sidebar tab. */
export const SIDEBAR_TAB_TARGET: Record<SidebarTab, TourTarget> = {
  content: 'contentTab',
  templates: 'templatesTab',
};
export type TourSide = 'top' | 'right' | 'bottom' | 'left';

export function tourTargetProps(target: TourTarget) {
  return { 'data-tour': TOUR_TARGET[target] };
}

export function tourTargetSelector(target: TourTarget): string {
  return `[data-tour="${TOUR_TARGET[target]}"]`;
}

export interface TourStep {
  id: string;
  /** None: the card sits in the middle of the window, over the whole app dimmed. */
  target?: TourTarget;
  side?: TourSide;
  /** Shown before the step, so its target is on screen. */
  sidebarTab?: SidebarTab;
  /** The open template's history, unfolded even if the user folded it. */
  showsOpenTemplateHistory?: true;
  title: string;
  /** A shortcut's key, shown after the title as this platform writes it. */
  titleShortcutKey?: string;
  body: string;
}

export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Mosaic',
    body: 'A resume editor that keeps every file on this machine. A short pass through editing, history and export, about a minute.',
  },
  {
    id: 'content',
    target: 'content',
    side: 'right',
    sidebarTab: 'content',
    title: 'Edit content, not a document',
    body: 'Sections, entries, bullets. Click any line to edit it in place, and use the eye to leave something off the resume without deleting it.',
  },
  {
    id: 'preview',
    target: 'preview',
    side: 'left',
    title: 'The page you will actually send',
    body: 'Real page measurements, laid out the way the PDF is: a line break here is a line break in the file. Watch the page count.',
  },
  // Only what a first resume has on screen: its history holds one auto version and no
  // named ones, so named versions are introduced by the button that makes them.
  {
    id: 'history',
    target: 'history',
    side: 'right',
    sidebarTab: 'templates',
    showsOpenTemplateHistory: true,
    title: 'History keeps itself',
    body: 'Your draft saves as you type, and Mosaic keeps versions on its own as you edit. Read any of them before you restore it. Restoring adds a row, so nothing is overwritten.',
  },
  {
    id: 'name',
    target: 'nameVersion',
    side: 'bottom',
    title: 'Name version',
    titleShortcutKey: 'S',
    body: 'Name a version when you want to find it again, like “Sent for the design role”. Named versions stand out in history, in bold with the amber mark.',
  },
  {
    id: 'templates',
    target: 'templates',
    side: 'right',
    sidebarTab: 'templates',
    title: 'One template per story you tell',
    body: 'Each template is a tailored resume with its own history. Duplicate one before you rewrite it for a different role, and open a template to make it the draft you are editing.',
  },
  {
    id: 'export',
    target: 'export',
    side: 'bottom',
    title: 'Take it anywhere',
    body: 'PDF and DOCX for applications; Markdown, plain text or JSON for everything else. Files are made right here; nothing is uploaded.',
  },
];
