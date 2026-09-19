import { useRef } from 'react';
import { ChevronsDownUp, ChevronsUpDown, FileText, LayoutTemplate } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HEADER_OUTLINE_ID, useOutlineStore } from '@/stores/outlineStore';
import { useResumeStore } from '@/stores/resumeStore';
import { useUiStore, type SidebarTab, SIDEBAR_WIDTH } from '@/stores/uiStore';
import { ContentTab } from '@/features/editor/ContentTab';
import { TemplatesTab } from '@/features/templates/TemplatesTab';
import { formatPaneWidth, startPaneResize } from './paneResize';

const tabs: { id: SidebarTab; label: string; caption: string; icon: React.ReactNode }[] = [
  {
    id: 'content',
    label: 'Content',
    caption: 'This resume',
    icon: <FileText className="size-[0.8125rem]" />,
  },
  {
    id: 'templates',
    label: 'Templates',
    caption: 'Saved templates',
    icon: <LayoutTemplate className="size-[0.8125rem]" />,
  },
];

/** The design's segmented tabs (`.panetab`): the chosen one is a raised panel. */
const TAB_TRIGGER =
  'h-[1.9375rem] flex-1 gap-[0.4375rem] rounded-md border border-transparent text-[0.84375rem] font-medium text-ink-muted hover:bg-line hover:text-ink-soft data-[state=active]:border-line data-[state=active]:bg-pane-raised data-[state=active]:text-foreground data-[state=active]:shadow-[0_1px_2px_oklch(0_0_0/22%)] dark:text-ink-muted dark:hover:text-ink-soft dark:data-[state=active]:border-line dark:data-[state=active]:bg-pane-raised dark:data-[state=active]:text-foreground';

export function Sidebar() {
  const activeSidebarTab = useUiStore((s) => s.activeSidebarTab);
  const setActiveSidebarTab = useUiStore((s) => s.setActiveSidebarTab);
  const widthPx = useUiStore((s) => s.sidebarWidthPx);
  const setWidthPx = useUiStore((s) => s.setSidebarWidthPx);
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const sidebarRef = useRef<HTMLElement>(null);

  // Hidden and shown from the status bar, or with Ctrl/⌘+B.
  if (sidebarCollapsed) return null;

  const active = tabs.find((tab) => tab.id === activeSidebarTab) ?? tabs[0];

  return (
    <aside
      ref={sidebarRef}
      className="relative flex shrink-0 flex-col border-r border-line bg-pane"
      style={{ width: formatPaneWidth(widthPx, SIDEBAR_WIDTH) }}
    >
      <Tabs
        value={active.id}
        onValueChange={(value) => setActiveSidebarTab(value as SidebarTab)}
        className="min-h-0 flex-1 gap-0"
      >
        <TabsList className="h-auto w-full shrink-0 gap-[0.1875rem] rounded-none bg-transparent px-[0.5625rem] pt-[0.5625rem] pb-[0.4375rem]">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className={TAB_TRIGGER}>
              {tab.icon}
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="flex min-h-[1.5625rem] shrink-0 items-center justify-between gap-2 px-3 pt-0.5 pb-2">
          <span className="text-[0.65625rem] font-semibold tracking-[0.09em] text-ink-faint uppercase">
            {active.caption}
          </span>
          {active.id === 'content' && <CollapseAllButton />}
        </div>

        <TabsContent value="content" className="overflow-y-auto px-2.5 pb-3.5 @container/pane">
          <ContentTab />
        </TabsContent>
        <TabsContent value="templates" className="overflow-y-auto px-2.5 pb-3.5 @container/pane">
          <TemplatesTab />
        </TabsContent>
      </Tabs>

      <div
        // Thin resize handle keeps the sidebar adjustable without adding visual weight.
        onPointerDown={(event) =>
          startPaneResize(event, {
            pane: sidebarRef.current,
            anchor: 'left',
            limits: SIDEBAR_WIDTH,
            onDone: setWidthPx,
          })
        }
        onDoubleClick={() => setWidthPx(SIDEBAR_WIDTH.defaultPx)}
        title="Drag to resize · double-click to reset"
        className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize transition-colors hover:bg-amber-500 active:bg-amber-600"
      />
    </aside>
  );
}

/** Folds the header card and every section shut, or opens them all. */
function CollapseAllButton() {
  const isOpen = useResumeStore((s) => s.templateId !== null);
  const sectionIds = useResumeStore((s) => s.sections.map((section) => section.id).join(' '));
  const collapsedIds = useOutlineStore((s) => s.collapsedIds);
  const setAllOpen = useOutlineStore((s) => s.setAllOpen);

  if (!isOpen) return null;

  const ids = [HEADER_OUTLINE_ID, ...sectionIds.split(' ').filter(Boolean)];
  const isAnyOpen = ids.some((id) => !collapsedIds.includes(id));
  const label = isAnyOpen ? 'Collapse all' : 'Expand all';

  return (
    <AppButton
      variant="ghost"
      size="xs"
      shape="square"
      onClick={() => setAllOpen(ids, !isAnyOpen)}
      aria-label={label}
      title={label}
    >
      {isAnyOpen ? <ChevronsDownUp /> : <ChevronsUpDown />}
    </AppButton>
  );
}
