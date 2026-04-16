import { useCallback, useRef } from 'react';
import { FileText, LayoutTemplate, PanelLeftClose, PanelLeftOpen, Sparkles } from 'lucide-react';
import { useUIStore, type SidebarTab, SIDEBAR_MIN_PX, SIDEBAR_MAX_RATIO } from '@/stores/uiStore';
import { ContentTab } from '@/features/editor/ContentTab';
import { useIsMobile } from '@/lib/useIsMobile';

const tabs: { id: SidebarTab; label: string; icon: React.ReactNode }[] = [
  { id: 'content', label: 'Content', icon: <FileText className="h-4 w-4" /> },
  { id: 'templates', label: 'Templates', icon: <LayoutTemplate className="h-4 w-4" /> },
  { id: 'ai', label: 'AI Tools', icon: <Sparkles className="h-4 w-4" /> },
];

export function Sidebar() {
  const {
    activeSidebarTab,
    setActiveSidebarTab,
    sidebarRatio,
    sidebarCollapsed,
    setSidebarRatio,
    toggleSidebarCollapsed,
  } = useUIStore();
  const isMobile = useIsMobile();
  const sidebarRef = useRef<HTMLElement>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const sidebar = sidebarRef.current;
      const vw = window.innerWidth;

      const onPointerMove = (ev: PointerEvent) => {
        const ratio = ev.clientX / vw;
        const clampedPx = Math.max(SIDEBAR_MIN_PX, ratio * vw);
        const clampedRatio = Math.min(SIDEBAR_MAX_RATIO, clampedPx / vw);
        if (sidebar) {
          sidebar.style.width = `${clampedRatio * 100}vw`;
        }
      };

      const onPointerUp = (ev: PointerEvent) => {
        const ratio = ev.clientX / vw;
        setSidebarRatio(ratio);
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', onPointerUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', onPointerUp);
    },
    [setSidebarRatio]
  );

  if (!isMobile && sidebarCollapsed) {
    return (
      <aside className="flex shrink-0 flex-col border-r border-border bg-card">
        <button
          onClick={toggleSidebarCollapsed}
          className="p-2.5 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Expand sidebar"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
      </aside>
    );
  }

  return (
    <aside
      ref={sidebarRef}
      className="relative flex flex-1 flex-col border-r border-border bg-card md:shrink-0 md:flex-none"
      style={
        isMobile
          ? { width: '100%' }
          : { width: `max(${SIDEBAR_MIN_PX}px, ${sidebarRatio * 100}vw)` }
      }
    >
      <div className="flex border-b border-border @container/tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSidebarTab(tab.id)}
            aria-label={tab.label}
            className={`flex flex-1 items-center justify-center gap-1.5 px-2 py-3 text-sm font-medium transition-colors @[18rem]/tabs:text-base ${
              activeSidebarTab === tab.id
                ? 'border-b-2 border-amber-500 text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.icon}
            <span className="hidden @[18rem]/tabs:inline">{tab.label}</span>
          </button>
        ))}
        {!isMobile && (
          <button
            onClick={toggleSidebarCollapsed}
            className="shrink-0 px-2 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-5">
        {activeSidebarTab === 'content' && <ContentTab />}
        {activeSidebarTab === 'templates' && (
          <div className="text-sm text-muted-foreground">Saved templates will appear here.</div>
        )}
        {activeSidebarTab === 'ai' && (
          <div className="text-sm text-muted-foreground">
            AI tools and settings will appear here.
          </div>
        )}
      </div>

      {!isMobile && (
        <div
          onPointerDown={onPointerDown}
          className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize transition-colors hover:bg-amber-500 active:bg-amber-600"
        />
      )}
    </aside>
  );
}
