import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SidebarTab = 'content' | 'templates' | 'ai';

interface UIState {
  darkMode: boolean;
  activeSidebarTab: SidebarTab;
  toggleDarkMode: () => void;
  setActiveSidebarTab: (tab: SidebarTab) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      darkMode: true,
      activeSidebarTab: 'content',
      toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
      setActiveSidebarTab: (tab) => set({ activeSidebarTab: tab }),
    }),
    {
      name: 'mosaic-ui',
    }
  )
);
