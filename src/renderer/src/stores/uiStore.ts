import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { settingsStorage } from '@/lib/storage/settingsStorage';
import type { PaperSize } from '@/types/paper';

export type SidebarTab = 'content' | 'templates';

/** Sidebar width stored as a ratio (0–1) of the viewport width */
export const SIDEBAR_DEFAULT_RATIO = 0.22;
/** Enough for the editor's cards to keep a line of text; the preview scales to what is left. */
export const SIDEBAR_MIN_PX = 280;
export const SIDEBAR_MAX_RATIO = 0.4;
/** The assistant pane on the right, sized the same way: a share of the window, with a floor. */
export const AGENT_PANE_DEFAULT_RATIO = 0.24;
export const AGENT_PANE_MIN_PX = 300;
export const AGENT_PANE_MAX_RATIO = 0.4;
export const PREVIEW_ZOOM_STEPS = [0.75, 0.9, 1, 1.1, 1.25, 1.5] as const;
export const PREVIEW_DEFAULT_ZOOM = 1;

function normalizePreviewZoom(zoom: number) {
  return PREVIEW_ZOOM_STEPS.reduce((closest, step) =>
    Math.abs(step - zoom) < Math.abs(closest - zoom) ? step : closest
  );
}

export const DEFAULT_UI_STATE = {
  darkMode: true,
  activeSidebarTab: 'content' as SidebarTab,
  currentPreviewPage: 1,
  paperSize: 'a4' as PaperSize,
  previewZoom: PREVIEW_DEFAULT_ZOOM,
  sidebarRatio: SIDEBAR_DEFAULT_RATIO,
  sidebarCollapsed: false,
  /** Only drawn while AI is on; this remembers whether it was closed. */
  agentPaneOpen: true,
  agentPaneRatio: AGENT_PANE_DEFAULT_RATIO,
  /** Icons beside the header's items in the editor; the page never has them. */
  shouldShowHeaderIcons: true,
};

interface UIState {
  darkMode: boolean;
  activeSidebarTab: SidebarTab;
  currentPreviewPage: number;
  paperSize: PaperSize;
  previewZoom: number;
  sidebarRatio: number;
  sidebarCollapsed: boolean;
  agentPaneOpen: boolean;
  agentPaneRatio: number;
  shouldShowHeaderIcons: boolean;
  toggleDarkMode: () => void;
  setDarkMode: (enabled: boolean) => void;
  setActiveSidebarTab: (tab: SidebarTab) => void;
  setCurrentPreviewPage: (page: number) => void;
  setPaperSize: (size: PaperSize) => void;
  setPreviewZoom: (zoom: number) => void;
  zoomPreviewIn: () => void;
  zoomPreviewOut: () => void;
  setSidebarRatio: (ratio: number) => void;
  toggleSidebarCollapsed: () => void;
  toggleAgentPane: () => void;
  setAgentPaneRatio: (ratio: number) => void;
  toggleHeaderIcons: () => void;
  resetUIState: () => void;
}

export const useUIStore = create<UIState>()(
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
          state.previewZoom = normalizePreviewZoom(zoom);
        }),
      zoomPreviewIn: () =>
        set((state) => {
          const index = PREVIEW_ZOOM_STEPS.indexOf(normalizePreviewZoom(state.previewZoom));
          state.previewZoom =
            PREVIEW_ZOOM_STEPS[Math.min(PREVIEW_ZOOM_STEPS.length - 1, index + 1)];
        }),
      zoomPreviewOut: () =>
        set((state) => {
          const index = PREVIEW_ZOOM_STEPS.indexOf(normalizePreviewZoom(state.previewZoom));
          state.previewZoom = PREVIEW_ZOOM_STEPS[Math.max(0, index - 1)];
        }),
      setSidebarRatio: (ratio) =>
        set((state) => {
          state.sidebarRatio = Math.min(SIDEBAR_MAX_RATIO, Math.max(0.1, ratio));
        }),
      toggleSidebarCollapsed: () =>
        set((state) => {
          state.sidebarCollapsed = !state.sidebarCollapsed;
        }),
      toggleAgentPane: () =>
        set((state) => {
          state.agentPaneOpen = !state.agentPaneOpen;
        }),
      setAgentPaneRatio: (ratio) =>
        set((state) => {
          state.agentPaneRatio = Math.min(AGENT_PANE_MAX_RATIO, Math.max(0.1, ratio));
        }),
      toggleHeaderIcons: () =>
        set((state) => {
          state.shouldShowHeaderIcons = !state.shouldShowHeaderIcons;
        }),
      resetUIState: () =>
        set((state) => {
          Object.assign(state, DEFAULT_UI_STATE);
        }),
    })),
    {
      name: 'ui',
      storage: createJSONStorage(() => settingsStorage),
      // AI Tools was a sidebar tab before the assistant moved to its own pane.
      merge: (persisted, current) => {
        const stored = (persisted ?? {}) as Partial<UIState>;
        const tab = stored.activeSidebarTab === 'templates' ? 'templates' : 'content';
        return { ...current, ...stored, activeSidebarTab: tab };
      },
      // Hydrated by `hydrateStores` once boot has loaded the settings.
      skipHydration: true,
    }
  )
);
