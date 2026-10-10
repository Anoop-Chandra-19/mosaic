import type { SidebarTab } from '@/stores/uiStore';

/*
 * The app's landmarks a tour can point at: what the app has, not what a tour needs. Each is
 * marked once where it renders, with `tourTargetProps`, and every tour's steps pick from
 * this list, so an element several tours show is marked once. Grouped by area; if it
 * outgrows a screen, split it by area, never by tour.
 */
export const TOUR_TARGET = {
  // The shell: the panes and the top bar.
  content: 'content',
  preview: 'preview',
  nameVersion: 'name-version',
  settings: 'settings',
  export: 'export',
  contentTab: 'content-tab',
  templatesTab: 'templates-tab',
  // Templates: the list, and the open template's history in it.
  templates: 'templates',
  history: 'history',
  // The full history: its list, the rows in it, the read pane and the settings.
  historyList: 'history-list',
  namedVersion: 'named-version',
  readVersion: 'read-version',
  historyCompare: 'history-compare',
  historyRestore: 'history-restore',
  historySettings: 'history-settings',
} as const;

export type TourTarget = keyof typeof TOUR_TARGET;

/** Each sidebar tab's own button, for a step that leads to that tab. */
export const SIDEBAR_TAB_TARGET: Record<SidebarTab, TourTarget> = {
  content: 'contentTab',
  templates: 'templatesTab',
};

/** Marks an element as one landmark or more: a named row can also be the one being read. */
export function tourTargetProps(...targets: (TourTarget | false)[]) {
  const names = targets.filter((target) => target !== false).map((target) => TOUR_TARGET[target]);
  return names.length ? { 'data-tour': names.join(' ') } : {};
}

export function tourTargetSelector(target: TourTarget): string {
  return `[data-tour~="${TOUR_TARGET[target]}"]`;
}
