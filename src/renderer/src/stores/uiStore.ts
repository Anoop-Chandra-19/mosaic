import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { settingsStorage } from '@/lib/storage/settingsStorage';
import type { PaperSize } from '@/types/paper';

export type SidebarTab = 'content' | 'templates';

/** The chrome's theme. System follows the operating system, and changes when it does. */
export type ThemeChoice = 'dark' | 'light' | 'system';
const THEME_CHOICES: readonly ThemeChoice[] = ['dark', 'light', 'system'];

/**
 * What a launch shows once there are templates: the last one as it was left, the Start
 * panel over it, or the last one with the sidebar on Templates to pick another.
 */
export type LaunchView = 'last' | 'start' | 'templates';
const LAUNCH_VIEWS: readonly LaunchView[] = ['last', 'start', 'templates'];

/** How many steps back Ctrl/⌘+Z can go within one open draft. */
export const UNDO_HISTORY_STEP_OPTIONS = [50, 200, 500] as const;
export type UndoHistorySteps = (typeof UNDO_HISTORY_STEP_OPTIONS)[number];

/** `value` when it is one of `choices`, else `fallback`: stored settings are not trusted. */
function pickChoice<T>(value: unknown, choices: readonly T[], fallback: T): T {
  return choices.includes(value as T) ? (value as T) : fallback;
}

/**
 * A side pane's width, kept in pixels like a code editor's: it comes back exactly as it was
 * left. `maxShare` is the most of the window it takes, so on a small window the preview
 * keeps its room; the stored width is untouched and returns when the window grows.
 */
export interface PaneWidthLimits {
  defaultPx: number;
  minPx: number;
  maxPx: number;
  maxShare: number;
}

/** The content sidebar. The floor keeps the editor's cards a line of text wide. */
export const SIDEBAR_WIDTH: PaneWidthLimits = {
  defaultPx: 380,
  minPx: 300,
  maxPx: 600,
  maxShare: 0.42,
};
/** The assistant pane on the right. */
export const AGENT_PANE_WIDTH: PaneWidthLimits = {
  defaultPx: 352,
  minPx: 300,
  maxPx: 620,
  maxShare: 0.38,
};

/** A width within the pane's limits, in whole pixels; anything unreadable is the default. */
export function clampPaneWidth(px: number, limits: PaneWidthLimits): number {
  if (!Number.isFinite(px)) return limits.defaultPx;
  return Math.round(Math.min(limits.maxPx, Math.max(limits.minPx, px)));
}
/** What the zoom buttons step through. The wheel is free to land anywhere between. */
export const PREVIEW_ZOOM_STEPS = [0.75, 0.9, 1, 1.15, 1.3, 1.5, 2, 3] as const;
/** 100% is the page fitted to the panel's width, as in a PDF viewer. */
export const PREVIEW_DEFAULT_ZOOM = 1;
export const PREVIEW_ZOOM_RANGE = { min: 0.5, max: 3 } as const;

function clampPreviewZoom(zoom: number) {
  if (!Number.isFinite(zoom)) return PREVIEW_DEFAULT_ZOOM;
  return Math.min(PREVIEW_ZOOM_RANGE.max, Math.max(PREVIEW_ZOOM_RANGE.min, zoom));
}

/** The next step past `zoom`, going up or down; undefined at either end. */
export function nextPreviewZoomStep(zoom: number, direction: 1 | -1): number | undefined {
  const steps = direction === 1 ? [...PREVIEW_ZOOM_STEPS] : [...PREVIEW_ZOOM_STEPS].reverse();
  return steps.find((step) => (direction === 1 ? step > zoom + 0.001 : step < zoom - 0.001));
}

export const DEFAULT_UI_STATE = {
  theme: 'dark' as ThemeChoice,
  openOnLaunch: 'last' as LaunchView,
  undoHistorySteps: 200 as UndoHistorySteps,
  /** Off gives the editor the whole width, for a small screen. */
  shouldShowPreview: true,
  activeSidebarTab: 'content' as SidebarTab,
  currentPreviewPage: 1,
  paperSize: 'a4' as PaperSize,
  previewZoom: PREVIEW_DEFAULT_ZOOM,
  sidebarWidthPx: SIDEBAR_WIDTH.defaultPx,
  sidebarCollapsed: false,
  /** Only drawn while AI is on; this remembers whether it was closed. */
  agentPaneOpen: true,
  agentPaneWidthPx: AGENT_PANE_WIDTH.defaultPx,
  /** Icons beside the header's items in the editor; the page never has them. */
  shouldShowHeaderIcons: true,
};

interface UiState {
  theme: ThemeChoice;
  openOnLaunch: LaunchView;
  undoHistorySteps: UndoHistorySteps;
  shouldShowPreview: boolean;
  activeSidebarTab: SidebarTab;
  currentPreviewPage: number;
  paperSize: PaperSize;
  previewZoom: number;
  sidebarWidthPx: number;
  sidebarCollapsed: boolean;
  agentPaneOpen: boolean;
  agentPaneWidthPx: number;
  shouldShowHeaderIcons: boolean;
  setTheme: (theme: ThemeChoice) => void;
  setOpenOnLaunch: (view: LaunchView) => void;
  setUndoHistorySteps: (steps: UndoHistorySteps) => void;
  setShouldShowPreview: (shown: boolean) => void;
  setActiveSidebarTab: (tab: SidebarTab) => void;
  setCurrentPreviewPage: (page: number) => void;
  setPaperSize: (size: PaperSize) => void;
  setPreviewZoom: (zoom: number) => void;
  zoomPreviewIn: () => void;
  zoomPreviewOut: () => void;
  setSidebarWidthPx: (px: number) => void;
  toggleSidebarCollapsed: () => void;
  toggleAgentPane: () => void;
  setAgentPaneWidthPx: (px: number) => void;
  toggleHeaderIcons: () => void;
  resetUiState: () => void;
}

export const useUiStore = create<UiState>()(
  persist(
    immer((set) => ({
      ...DEFAULT_UI_STATE,
      setTheme: (theme) =>
        set((state) => {
          state.theme = theme;
        }),
      setOpenOnLaunch: (view) =>
        set((state) => {
          state.openOnLaunch = view;
        }),
      setUndoHistorySteps: (steps) =>
        set((state) => {
          state.undoHistorySteps = steps;
        }),
      setShouldShowPreview: (shown) =>
        set((state) => {
          state.shouldShowPreview = shown;
        }),
      setActiveSidebarTab: (tab) =>
        set((state) => {
          state.activeSidebarTab = tab;
        }),
      setCurrentPreviewPage: (page) =>
        set((state) => {
          state.currentPreviewPage = Math.max(1, Math.floor(page));
        }),
      setPaperSize: (size) =>
        set((state) => {
          state.paperSize = size;
        }),
      setPreviewZoom: (zoom) =>
        set((state) => {
          state.previewZoom = clampPreviewZoom(zoom);
        }),
      zoomPreviewIn: () =>
        set((state) => {
          state.previewZoom = nextPreviewZoomStep(state.previewZoom, 1) ?? state.previewZoom;
        }),
      zoomPreviewOut: () =>
        set((state) => {
          state.previewZoom = nextPreviewZoomStep(state.previewZoom, -1) ?? state.previewZoom;
        }),
      setSidebarWidthPx: (px) =>
        set((state) => {
          state.sidebarWidthPx = clampPaneWidth(px, SIDEBAR_WIDTH);
        }),
      toggleSidebarCollapsed: () =>
        set((state) => {
          state.sidebarCollapsed = !state.sidebarCollapsed;
        }),
      toggleAgentPane: () =>
        set((state) => {
          state.agentPaneOpen = !state.agentPaneOpen;
        }),
      setAgentPaneWidthPx: (px) =>
        set((state) => {
          state.agentPaneWidthPx = clampPaneWidth(px, AGENT_PANE_WIDTH);
        }),
      toggleHeaderIcons: () =>
        set((state) => {
          state.shouldShowHeaderIcons = !state.shouldShowHeaderIcons;
        }),
      resetUiState: () =>
        set((state) => {
          Object.assign(state, DEFAULT_UI_STATE);
        }),
    })),
    {
      name: 'ui',
      storage: createJSONStorage(() => settingsStorage),
      // AI Tools was a sidebar tab before the assistant moved to its own pane. Widths were
      // once shares of the window, and the theme a dark-or-not switch; those keys are simply
      // left behind.
      merge: (persisted, current) => {
        const stored = { ...(persisted as Record<string, unknown>) } as Partial<UiState>;
        for (const key of ['sidebarRatio', 'agentPaneRatio', 'darkMode']) {
          delete (stored as never)[key];
        }
        const tab = stored.activeSidebarTab === 'templates' ? 'templates' : 'content';
        return {
          ...current,
          ...stored,
          activeSidebarTab: tab,
          theme: pickChoice(stored.theme, THEME_CHOICES, DEFAULT_UI_STATE.theme),
          openOnLaunch: pickChoice(
            stored.openOnLaunch,
            LAUNCH_VIEWS,
            DEFAULT_UI_STATE.openOnLaunch
          ),
          undoHistorySteps: pickChoice(
            stored.undoHistorySteps,
            UNDO_HISTORY_STEP_OPTIONS,
            DEFAULT_UI_STATE.undoHistorySteps
          ),
          sidebarWidthPx: clampPaneWidth(
            stored.sidebarWidthPx ?? SIDEBAR_WIDTH.defaultPx,
            SIDEBAR_WIDTH
          ),
          agentPaneWidthPx: clampPaneWidth(
            stored.agentPaneWidthPx ?? AGENT_PANE_WIDTH.defaultPx,
            AGENT_PANE_WIDTH
          ),
        };
      },
      // Hydrated by `hydrateStores` once boot has loaded the settings.
      skipHydration: true,
    }
  )
);
