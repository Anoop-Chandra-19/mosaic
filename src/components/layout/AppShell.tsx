import { useEffect } from 'react';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { PreviewPanel } from './PreviewPanel';
import { useUIStore } from '@/stores/uiStore';

export function AppShell() {
  const darkMode = useUIStore((s) => s.darkMode);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  return (
    <div className="flex h-screen flex-col">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <PreviewPanel />
      </div>
    </div>
  );
}
