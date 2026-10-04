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
import { AppTabs, AppTabsContent, AppTabsList, AppTabsTrigger } from '@/components/AppTabs';
import { AppTooltip } from '@/components/AppTooltip';
import { Text } from '@/components/Text';
import { cn } from '@/lib/utils';
import { HEADER_OUTLINE_ID, useOutlineStore } from '@/stores/outlineStore';
import { attempt, showToast, useOverlayStore, type VersionPreview } from '@/stores/overlayStore';
import { useResumeStore } from '@/stores/resumeStore';
import { useTemplateStore } from '@/stores/templateStore';
import { useUiStore, type SidebarTab, SIDEBAR_WIDTH } from '@/stores/uiStore';
import { ContentTab } from '@/features/editor/ContentTab';
import { TemplatesTab } from '@/features/templates/TemplatesTab';
import { SIDEBAR_TAB_TARGET, tourTargetProps } from '@/features/onboarding/tourSteps';
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

/**
 * The chosen tab's raised panel (the design's `.panetab.active`), one for both tabs, so it
 * slides to the chosen one. No `top`: the list centers it as it centers the tabs.
 */
const TAB_PANEL =
  'pointer-events-none absolute left-2.25 h-[1.9375rem] w-[calc((100%-1.3125rem)/2)] rounded-sm border border-line bg-pane-raised shadow-lifted transition-transform duration-200 ease-settle motion-reduce:transition-none';

export function Sidebar() {
  const activeSidebarTab = useUiStore((s) => s.activeSidebarTab);
  const setActiveSidebarTab = useUiStore((s) => s.setActiveSidebarTab);
  const widthPx = useUiStore((s) => s.sidebarWidthPx);
  const setWidthPx = useUiStore((s) => s.setSidebarWidthPx);
  const shouldShowPreview = useUiStore((s) => s.shouldShowPreview);
  const preview = useOverlayStore((s) => s.preview);
  const sidebarRef = useRef<HTMLElement>(null);

  const active = tabs.find((tab) => tab.id === activeSidebarTab) ?? tabs[0];

  return (
    <aside
      ref={sidebarRef}
      data-shortcut-place="sidebar"
      className={cn(
        'relative flex flex-col border-line bg-pane',
        shouldShowPreview ? 'shrink-0 border-r' : 'min-w-0 flex-1'
      )}
      style={shouldShowPreview ? { width: formatPaneWidth(widthPx, SIDEBAR_WIDTH) } : undefined}
    >
      <AppTabs
        value={active.id}
        onValueChange={(value) => setActiveSidebarTab(value as SidebarTab)}
        className="min-h-0 flex-1"
      >
        <AppTabsList className="relative shrink-0 gap-0.75 px-2.25 pt-2.25 pb-1.75">
          <span
            aria-hidden
            className={cn(
              TAB_PANEL,
              active.id === 'templates' && 'translate-x-[calc(100%+0.1875rem)]'
            )}
          />
          {tabs.map((tab) => (
            <AppTabsTrigger
              key={tab.id}
              value={tab.id}
              {...tourTargetProps(SIDEBAR_TAB_TARGET[tab.id])}
            >
              {tab.icon}
              {tab.label}
            </AppTabsTrigger>
          ))}
        </AppTabsList>

        <div className="flex min-h-6.25 shrink-0 items-center justify-between gap-2 px-3 pt-0.5 pb-2">
          <Text variant="eyebrow">{active.caption}</Text>
          {active.id === 'content' && <CollapseAllButton />}
        </div>

        <AppTabsContent
          value="content"
          className="overflow-y-auto px-2.5 pb-3.5 @container/pane"
          {...tourTargetProps('content')}
        >
          {preview && <ReadingVersionNote preview={preview} />}
          {/* Reading a version is a read mode, and both panes read the same document: the
              editor lays out the version itself, and nothing here can reach the draft. */}
          <div inert={preview !== null} data-reading={preview !== null || undefined}>
            <ContentTab doc={preview?.version.doc} />
          </div>
        </AppTabsContent>
        <AppTabsContent value="templates" className="overflow-y-auto px-2.5 pb-3.5 @container/pane">
          <TemplatesTab />
        </AppTabsContent>
      </AppTabs>

      {shouldShowPreview && (
        <AppTooltip
          side="right"
          content="Drag to resize · double-click to reset"
          shouldFollowPointer
        >
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
            className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize transition-colors hover:bg-amber active:bg-amber"
          />
        </AppTooltip>
      )}
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
    <div className="mb-2 rounded-md border border-amber-line bg-amber-soft p-2 text-support text-foreground">
      <div className="flex items-start gap-1.5">
        <Eye className="mt-0.5 size-3.5 shrink-0 text-amber" />
        <span className="min-w-0 flex-1">
          Reading <span className="font-mono font-strong">{label}</span>, not your draft. Restore it
          to edit it.
        </span>
      </div>
      <div className="mt-1.5 flex justify-end gap-1.5">
        <AppButton variant="ghost" size="xs" onClick={() => setPreview(null)}>
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
