import { FileText, LayoutTemplate, Sparkles } from 'lucide-react';
import { useUIStore, type SidebarTab } from '@/stores/uiStore';

const tabs: { id: SidebarTab; label: string; icon: React.ReactNode }[] = [
  { id: 'content', label: 'Content', icon: <FileText className="h-4 w-4" /> },
  { id: 'templates', label: 'Templates', icon: <LayoutTemplate className="h-4 w-4" /> },
  { id: 'ai', label: 'AI Tools', icon: <Sparkles className="h-4 w-4" /> },
];

export function Sidebar() {
  const { activeSidebarTab, setActiveSidebarTab } = useUIStore();

  return (
    <aside className="flex w-80 shrink-0 flex-col border-r border-border bg-card">
      <div className="flex border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSidebarTab(tab.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors ${
              activeSidebarTab === tab.id
                ? 'border-b-2 border-amber-500 text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeSidebarTab === 'content' && (
          <div className="text-sm text-muted-foreground">Resume sections will appear here.</div>
        )}
        {activeSidebarTab === 'templates' && (
          <div className="text-sm text-muted-foreground">Saved templates will appear here.</div>
        )}
        {activeSidebarTab === 'ai' && (
          <div className="text-sm text-muted-foreground">
            AI tools and settings will appear here.
          </div>
        )}
      </div>
    </aside>
  );
}
