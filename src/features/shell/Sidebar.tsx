import { useRef } from 'react';
import { FileText, LayoutTemplate } from 'lucide-react';
import { useUIStore, type SidebarTab, SIDEBAR_MIN_PX, SIDEBAR_MAX_RATIO } from '@/stores/uiStore';
import { ContentTab } from '@/features/editor/ContentTab';
import { TemplatesTab } from '@/features/templates/TemplatesTab';
import { startPaneResize } from './paneResize';

const tabs: { id: SidebarTab; label: string; icon: React.ReactNode }[] = [
  { id: 'content', label: 'Content', icon: <FileText className="h-4 w-4" /> },
  { id: 'templates', label: 'Templates', icon: <LayoutTemplate className="h-4 w-4" /> },
];

export function Sidebar() {
  const { activeSidebarTab, setActiveSidebarTab, sidebarRatio, sidebarCollapsed, setSidebarRatio } =
    useUIStore();
  const sidebarRef = useRef<HTMLElement>(null);

  // Hidden and shown from the status bar, or with Ctrl/⌘+B.
  if (sidebarCollapsed) return null;

  return (
    <aside
      ref={sidebarRef}
      className="relative flex shrink-0 flex-col border-r border-border bg-card"
      style={{ width: `max(${SIDEBAR_MIN_PX}px, ${sidebarRatio * 100}vw)` }}
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
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {activeSidebarTab === 'content' && <ContentTab />}
        {activeSidebarTab === 'templates' && <TemplatesTab />}
      </div>

      <div
        // Thin resize handle keeps the sidebar adjustable without adding visual weight.
        onPointerDown={(event) =>
          startPaneResize(event, {
            pane: sidebarRef.current,
            anchor: 'left',
            minPx: SIDEBAR_MIN_PX,
            maxRatio: SIDEBAR_MAX_RATIO,
            onDone: setSidebarRatio,
          })
        }
        className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize transition-colors hover:bg-amber-500 active:bg-amber-600"
      />
    </aside>
  );
}
