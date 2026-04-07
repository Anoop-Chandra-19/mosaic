import { useEffect } from 'react';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { PreviewPanel } from './PreviewPanel';
import { useIsMobile } from '@/lib/useIsMobile';
import { useUIStore } from '@/stores/uiStore';

export function AppShell() {
  const darkMode = useUIStore((s) => s.darkMode);
  const mobilePane = useUIStore((s) => s.mobilePane);
  const isMobile = useIsMobile();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  return (
    <div className="flex h-screen flex-col">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        {isMobile ? (
          mobilePane === 'editor' ? (
            <Sidebar />
          ) : (
            <PreviewPanel />
          )
        ) : (
          <>
            <Sidebar />
            <PreviewPanel />
          </>
        )}
      </div>
    </div>
  );
}
