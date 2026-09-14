import { useRef } from 'react';
import { FileText, LayoutTemplate, PanelLeftClose, PanelLeftOpen, Sparkles } from 'lucide-react';
import { useAIStore } from '@/stores/aiStore';
import { useOverlayStore } from '@/stores/overlayStore';
import { useUIStore, type SidebarTab, SIDEBAR_MIN_PX, SIDEBAR_MAX_RATIO } from '@/stores/uiStore';
import { ContentTab } from '@/features/editor/ContentTab';
import { TemplatesTab } from '@/features/templates/TemplatesTab';
import { startPaneResize } from './paneResize';

const tabs: { id: SidebarTab; label: string; icon: React.ReactNode }[] = [
  { id: 'content', label: 'Content', icon: <FileText className="h-4 w-4" /> },
  { id: 'templates', label: 'Templates', icon: <LayoutTemplate className="h-4 w-4" /> },
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
  const aiEnabled = useAIStore((s) => s.enabled);
  const sidebarRef = useRef<HTMLElement>(null);

  if (sidebarCollapsed) {
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
        <button
          onClick={toggleSidebarCollapsed}
          className="shrink-0 px-2 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Collapse sidebar"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {activeSidebarTab === 'content' && <ContentTab />}
        {activeSidebarTab === 'templates' && <TemplatesTab />}
      </div>

      {!aiEnabled && <AiOffHint />}

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

/** While AI is off: everything works without it, and here is where it is turned on. */
function AiOffHint() {
  const openSettings = useOverlayStore((s) => s.openSettings);
  return (
    <div className="m-2.5 mt-0 flex gap-2.5 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
      <Sparkles className="mt-px size-3.5 shrink-0 text-zinc-500" />
      <div>
        <p className="mb-0.5 font-medium text-zinc-900 dark:text-zinc-100">AI features are off</p>
        Everything here works without them. Turn them on in{' '}
        <button
          type="button"
          onClick={() => openSettings('ai')}
          className="font-medium text-amber-700 hover:underline dark:text-amber-400"
        >
          Settings → AI
        </button>
        .
      </div>
    </div>
  );
}
