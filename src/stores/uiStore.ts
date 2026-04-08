import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { dexieStorage } from '@/lib/dexieStorage';
import type { PaperSize } from '@/types/ui';

export type SidebarTab = 'content' | 'templates' | 'ai';
export type MobilePane = 'editor' | 'preview';

/** Sidebar width stored as a ratio (0–1) of the viewport width */
export const SIDEBAR_DEFAULT_RATIO = 0.22;
export const SIDEBAR_MIN_PX = 200;
export const SIDEBAR_MAX_RATIO = 0.4;

interface UIState {
  darkMode: boolean;
  activeSidebarTab: SidebarTab;
  mobilePane: MobilePane;
  currentPreviewPage: number;
  paperSize: PaperSize;
  sidebarRatio: number;
  sidebarCollapsed: boolean;
  toggleDarkMode: () => void;
  setActiveSidebarTab: (tab: SidebarTab) => void;
  setMobilePane: (pane: MobilePane) => void;
  setCurrentPreviewPage: (page: number) => void;
  setPaperSize: (size: PaperSize) => void;
  setSidebarRatio: (ratio: number) => void;
  toggleSidebarCollapsed: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      darkMode: true,
      activeSidebarTab: 'content',
      mobilePane: 'editor',
      currentPreviewPage: 1,
      paperSize: 'a4',
      sidebarRatio: SIDEBAR_DEFAULT_RATIO,
      sidebarCollapsed: false,
      toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
      setActiveSidebarTab: (tab) => set({ activeSidebarTab: tab }),
      setMobilePane: (pane) => set({ mobilePane: pane }),
      setCurrentPreviewPage: (page) => set({ currentPreviewPage: Math.max(1, Math.floor(page)) }),
      setPaperSize: (size) => set({ paperSize: size }),
      setSidebarRatio: (ratio) =>
        set({ sidebarRatio: Math.min(SIDEBAR_MAX_RATIO, Math.max(0.1, ratio)) }),
      toggleSidebarCollapsed: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
    }),
    {
      name: 'mosaic-ui',
      storage: createJSONStorage(() => dexieStorage),
    }
  )
);
