import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { PreviewPanel } from './PreviewPanel';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { useUIStore } from '@/stores/uiStore';
import { useDarkMode } from '@/lib/hooks/useDarkMode';

export function AppShell() {
  useDarkMode();
  const mobilePane = useUIStore((s) => s.mobilePane);
  const isMobile = useIsMobile();

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
