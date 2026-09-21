import { useRef } from 'react';
import {
  ChevronsDownUp,
  ChevronsUpDown,
  Eye,
  FileText,
  History,
  LayoutTemplate,
} from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { AppTooltip } from '@/components/AppTooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HEADER_OUTLINE_ID, useOutlineStore } from '@/stores/outlineStore';
import { attempt, showToast, useOverlayStore, type VersionPreview } from '@/stores/overlayStore';
import { useResumeStore } from '@/stores/resumeStore';
import { useTemplateStore } from '@/stores/templateStore';
import { useUiStore, type SidebarTab, SIDEBAR_WIDTH } from '@/stores/uiStore';
import { ContentTab } from '@/features/editor/ContentTab';
import { TemplatesTab } from '@/features/templates/TemplatesTab';
import { formatPaneWidth, startPaneResize } from './paneResize';

const tabs: { id: SidebarTab; label: string; caption: string; icon: React.ReactNode }[] = [
  {
    id: 'content',
    label: 'Content',
    caption: 'This resume',
    icon: <FileText className="size-3.25" />,
  },
  {
    id: 'templates',
    label: 'Templates',
    caption: 'Saved templates',
    icon: <LayoutTemplate className="size-3.25" />,
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
  const preview = useOverlayStore((s) => s.preview);
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
        <TabsList className="h-auto w-full shrink-0 gap-0.75 rounded-none bg-transparent px-2.25 pt-2.25 pb-1.75">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className={TAB_TRIGGER}>
              {tab.icon}
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="flex min-h-6.25 shrink-0 items-center justify-between gap-2 px-3 pt-0.5 pb-2">
          <span className="text-[0.65625rem] font-semibold tracking-[0.09em] text-ink-faint uppercase">
            {active.caption}
          </span>
          {active.id === 'content' && <CollapseAllButton />}
        </div>

        <TabsContent value="content" className="overflow-y-auto px-2.5 pb-3.5 @container/pane">
          {preview && <ReadingVersionNote preview={preview} />}
          {/* Reading a version is a read mode, and both panes read the same document: the
              editor lays out the version itself, and nothing here can reach the draft. */}
          <div inert={preview !== null}>
            <ContentTab doc={preview?.version.doc} />
          </div>
        </TabsContent>
        <TabsContent value="templates" className="overflow-y-auto px-2.5 pb-3.5 @container/pane">
          <TemplatesTab />
        </TabsContent>
      </Tabs>

      <AppTooltip side="right" content="Drag to resize · double-click to reset">
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
          className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize transition-colors hover:bg-amber-500 active:bg-amber-600"
        />
      </AppTooltip>
    </aside>
  );
}

/**
 * What the editor is showing while a version is being read, and the two ways on: take this
 * version up as the draft, or leave it and go back to the draft as it was left.
 */
function ReadingVersionNote({ preview }: { preview: VersionPreview }) {
  const setPreview = useOverlayStore((s) => s.setPreview);
  const restoreVersion = useTemplateStore((s) => s.restoreVersion);
  const { version, label } = preview;

  const restore = async () => {
    if (
      await attempt(
        restoreVersion(version.templateId, version.id),
        'Could not restore that version'
      )
    ) {
      showToast(`Restored “${version.summary}”`);
    }
  };

  return (
    <div className="mb-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
      <div className="flex items-start gap-1.5">
        <Eye className="mt-px size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
        <span className="min-w-0 flex-1">
          Reading <span className="font-mono font-semibold">{label}</span>, not your draft. Restore
          it to edit it.
        </span>
      </div>
      <div className="mt-1.5 flex justify-end gap-1.5">
        <AppButton
          variant="ghost"
          size="xs"
          className="h-6 px-2 text-xs"
          onClick={() => setPreview(null)}
        >
          Back to draft
        </AppButton>
        <AppButton variant="accent" size="xs" onClick={() => void restore()}>
          <History className="size-3" />
          Restore to edit
        </AppButton>
      </div>
    </div>
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
