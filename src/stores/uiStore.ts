import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { dexieStorage } from '@/lib/dexieStorage';
import type { PaperSize } from '@/types/ui';

export type SidebarTab = 'content' | 'templates' | 'ai';
export type MobilePane = 'editor' | 'preview';

/** Sidebar width stored as a ratio (0–1) of the viewport width */
export const SIDEBAR_DEFAULT_RATIO = 0.22;
export const SIDEBAR_MIN_PX = 200;
export const SIDEBAR_MAX_RATIO = 0.4;

export const DEFAULT_UI_STATE = {
  darkMode: true,
  activeSidebarTab: 'content' as SidebarTab,
  mobilePane: 'editor' as MobilePane,
  currentPreviewPage: 1,
  paperSize: 'a4' as PaperSize,
  sidebarRatio: SIDEBAR_DEFAULT_RATIO,
  sidebarCollapsed: false,
};

interface UIState {
  darkMode: boolean;
  activeSidebarTab: SidebarTab;
  mobilePane: MobilePane;
  currentPreviewPage: number;
  paperSize: PaperSize;
  sidebarRatio: number;
  sidebarCollapsed: boolean;
  toggleDarkMode: () => void;
  setDarkMode: (enabled: boolean) => void;
  setActiveSidebarTab: (tab: SidebarTab) => void;
  setMobilePane: (pane: MobilePane) => void;
  setCurrentPreviewPage: (page: number) => void;
  setPaperSize: (size: PaperSize) => void;
  setSidebarRatio: (ratio: number) => void;
  toggleSidebarCollapsed: () => void;
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
      setMobilePane: (pane) =>
        set((state) => {
          state.mobilePane = pane;
        }),
      setCurrentPreviewPage: (page) =>
        set((state) => {
          state.currentPreviewPage = Math.max(1, Math.floor(page));
        }),
      setPaperSize: (size) =>
        set((state) => {
          state.paperSize = size;
        }),
      setSidebarRatio: (ratio) =>
        set((state) => {
          state.sidebarRatio = Math.min(SIDEBAR_MAX_RATIO, Math.max(0.1, ratio));
        }),
      toggleSidebarCollapsed: () =>
        set((state) => {
          state.sidebarCollapsed = !state.sidebarCollapsed;
        }),
      resetUIState: () =>
        set((state) => {
          Object.assign(state, DEFAULT_UI_STATE);
        }),
    })),
    {
      name: 'mosaic-ui',
      storage: createJSONStorage(() => dexieStorage),
    }
  )
);
