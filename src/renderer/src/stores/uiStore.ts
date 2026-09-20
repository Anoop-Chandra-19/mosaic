import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { settingsStorage } from '@/lib/storage/settingsStorage';
import type { PaperSize } from '@/types/paper';

export type SidebarTab = 'content' | 'templates';

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
  darkMode: true,
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
  darkMode: boolean;
  activeSidebarTab: SidebarTab;
  currentPreviewPage: number;
  paperSize: PaperSize;
  previewZoom: number;
  sidebarWidthPx: number;
  sidebarCollapsed: boolean;
  agentPaneOpen: boolean;
  agentPaneWidthPx: number;
  shouldShowHeaderIcons: boolean;
  toggleDarkMode: () => void;
  setDarkMode: (enabled: boolean) => void;
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
      toggleDarkMode: () =>
        set((state) => {
          state.darkMode = !state.darkMode;
        }),
      setDarkMode: (enabled) =>
        set((state) => {
          state.darkMode = enabled;
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
      // once shares of the window; those keys are simply left behind.
      merge: (persisted, current) => {
        const stored = { ...(persisted as Record<string, unknown>) } as Partial<UiState>;
        for (const key of ['sidebarRatio', 'agentPaneRatio']) delete (stored as never)[key];
        const tab = stored.activeSidebarTab === 'templates' ? 'templates' : 'content';
        return {
          ...current,
          ...stored,
          activeSidebarTab: tab,
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
