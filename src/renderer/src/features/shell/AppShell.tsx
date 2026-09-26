import { Suspense, useDeferredValue, useEffect, ViewTransition } from 'react';
import { READING_A_VERSION, TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { StatusBar } from './StatusBar';
import { PreviewPanel } from './PreviewPanel';
import { Toast } from './Toast';
import { AgentPane } from '@/features/agent/AgentPane';
import { RestoreBackupDialog } from '@/features/backup/RestoreBackupDialog';
import { ExportDialog } from '@/features/export/ExportDialog';
import { HistoryWindow } from '@/features/history/HistoryWindow';
import { ImportResumeDialog } from '@/features/import/ImportResumeDialog';
import { SettingsDialog } from '@/features/settings/SettingsDialog';
import { StartPanel } from '@/features/start/StartPanel';
import { NameVersionDialog } from '@/features/templates/NameVersionDialog';
import { useAutoSnapshot } from '@/features/templates/useAutoSnapshot';
import {
  SLIDE_AWAY_MOTION,
  SURFACE_MOTION,
  transitionClasses,
} from '@/features/view-transitions/transitionClasses';
import { cn } from '@/lib/utils';
import {
  useIsWorkspaceReplaced,
  useShownSurface,
} from '@/features/view-transitions/useShownSurface';
import { ShortcutsDialog } from '@/features/shortcuts/ShortcutsDialog';
import { SHORTCUTS } from '@/features/shortcuts/shortcutList';
import { isRedoKey, isTypingField, isUndoKey, matchesShortcut } from '@/lib/keyboardShortcuts';
import { useAiStore } from '@/stores/aiStore';
import { showToast, useOverlayStore } from '@/stores/overlayStore';
import { useResumeStore } from '@/stores/resumeStore';
import { useTemplateStore } from '@/stores/templateStore';
import { PREVIEW_DEFAULT_ZOOM, useUiStore, type SidebarTab } from '@/stores/uiStore';
import { useApplyDensity } from '@/lib/hooks/useDensity';
import { useApplyTheme } from '@/lib/hooks/useTheme';

export function AppShell() {
  useApplyTheme();
  useApplyDensity();
  useShortcuts();
  useAutoSnapshot();
  const hasTemplates = useTemplateStore((s) => s.templates.length > 0);
  const surface = useOverlayStore((s) => s.surface);
  const shownSurface = useShownSurface();
  const isWorkspaceReplaced = useIsWorkspaceReplaced();
  const aiEnabled = useAiStore((s) => s.enabled);
  const agentPaneOpen = useUiStore((s) => s.agentPaneOpen);
  const showAgentPane = aiEnabled && agentPaneOpen;
  const shouldShowPreview = useUiStore((s) => s.shouldShowPreview);
  // Deferred, like the surface, so hiding and showing it is a view transition.
  const isSidebarCollapsed = useDeferredValue(useUiStore((s) => s.sidebarCollapsed));

  return (
    // Editor and preview side by side, at every window size; the assistant joins them on
    // the right when AI is on.
    <div className="flex h-screen flex-col">
      <TopBar />
      <div className="relative flex flex-1 overflow-hidden">
        {/* Under a surface the workspace stays mounted, as it was, but out of reach. */}
        <div
          // Hidden once replaced, or it shows through the view fading in over it.
          className={cn(
            'relative flex flex-1 overflow-hidden @container/workspace',
            isWorkspaceReplaced
              ? 'invisible'
              : transitionClasses({ name: 'workspace', motion: 'recede' })
          )}
          inert={surface !== null}
        >
          {/* Without the preview beside it, the sidebar is the editor and never hides. */}
          {!(isSidebarCollapsed && shouldShowPreview) && (
            <ViewTransition enter={SLIDE_AWAY_MOTION.in} exit={SLIDE_AWAY_MOTION.out} update="none">
              <Sidebar />
            </ViewTransition>
          )}
          {shouldShowPreview && <PreviewPanel />}
          {showAgentPane && <AgentPane />}
        </div>
        {surface?.kind === 'start' && <StartPanel closable={hasTemplates} />}
        {/* Mounted from the start, so a surface still loading keeps the one before on screen. */}
        <Suspense fallback={null}>
          {shownSurface?.kind === 'history' && (
            <ViewTransition enter={SURFACE_MOTION.in} exit={SURFACE_MOTION.out}>
              <HistoryWindow
                opening={shownSurface}
                templateId={shownSurface.templateId}
                filter={shownSurface.filter}
                versionId={shownSurface.versionId}
              />
            </ViewTransition>
          )}
        </Suspense>
        <Toast />
      </div>
      <StatusBar />
      <SettingsDialog />
      <ImportResumeDialog />
      <RestoreBackupDialog />
      <ExportDialog />
      <NameVersionDialog />
      <ShortcutsDialog />
    </div>
  );
}

const NOTHING_OPEN = 'Nothing is open. Start a resume first.';

/** The sidebar, shown, on `tab`. */
function showSidebarTab(tab: SidebarTab) {
  const ui = useUiStore.getState();
  ui.setActiveSidebarTab(tab);
  if (ui.sidebarCollapsed) ui.toggleSidebarCollapsed();
}

/**
 * The shortcuts that work anywhere in the window (`SHORTCUTS`). Undo and redo leave a field
 * that is being typed in alone: the browser's own undo belongs to it. Ctrl/⌘+S names a
 * version; the draft itself is always saved already.
 *
 * While a surface covers the workspace, only those marked `worksOverSurface` run: the
 * rest act on the editor, and would change what is out of sight.
 */
const GLOBAL_SHORTCUTS: { combos: string[]; run: () => void; worksOverSurface?: true }[] = [
  {
    combos: [SHORTCUTS.openSettings],
    run: () => useOverlayStore.getState().openSettings(),
    worksOverSurface: true,
  },
  {
    combos: [SHORTCUTS.showShortcuts],
    run: () => useOverlayStore.getState().setShortcutsOpen(true),
    worksOverSurface: true,
  },
  {
    combos: [SHORTCUTS.toggleSidebar],
    run: () => {
      if (useUiStore.getState().shouldShowPreview) useUiStore.getState().toggleSidebarCollapsed();
    },
  },
  {
    combos: [SHORTCUTS.toggleAssistant, SHORTCUTS.toggleAssistantBackslash],
    run: () => {
      if (useAiStore.getState().enabled) useUiStore.getState().toggleAgentPane();
    },
  },
  {
    combos: [SHORTCUTS.nameVersion],
    run: () => {
      if (useResumeStore.getState().templateId === null) showToast(NOTHING_OPEN);
      else useOverlayStore.getState().setNameVersionOpen(true);
    },
  },
  // Opens the open template's history, and closes it again: a view you toggle, like a pane.
  {
    combos: [SHORTCUTS.showHistory],
    run: () => {
      const overlay = useOverlayStore.getState();
      if (overlay.surface?.kind === 'history') return overlay.closeSurface('history');
      if (overlay.surface) return;
      const templateId = useResumeStore.getState().templateId;
      if (templateId === null) showToast(NOTHING_OPEN);
      else overlay.openSurface({ kind: 'history', templateId });
    },
    worksOverSurface: true,
  },
  // On the Start panel the same keys make a blank resume; the panel listens for that.
  {
    combos: [SHORTCUTS.newTemplate],
    run: () => useOverlayStore.getState().openSurface({ kind: 'start' }),
    worksOverSurface: true,
  },
  { combos: [SHORTCUTS.switchTemplate], run: () => showSidebarTab('templates') },
  {
    combos: [SHORTCUTS.exportResume],
    run: () => {
      if (useResumeStore.getState().templateId === null) showToast(NOTHING_OPEN);
      else useOverlayStore.getState().openExport();
    },
  },
  {
    combos: [SHORTCUTS.importResume],
    run: () => useOverlayStore.getState().openImport(useResumeStore.getState().templateId === null),
    worksOverSurface: true,
  },
  {
    combos: [SHORTCUTS.newSection],
    run: () => {
      if (useResumeStore.getState().templateId === null) return showToast(NOTHING_OPEN);
      if (useOverlayStore.getState().preview) return showToast(READING_A_VERSION);
      showSidebarTab('content');
      // An empty resume suggests its sections in place of the menu, so those are shown.
      const isEmpty = useResumeStore
        .getState()
        .sections.every((section) => section.items.length === 0);
      if (!isEmpty) useOverlayStore.getState().setAddSectionMenuOpen(true);
    },
  },
  { combos: [SHORTCUTS.zoomIn], run: () => useUiStore.getState().zoomPreviewIn() },
  { combos: [SHORTCUTS.zoomOut], run: () => useUiStore.getState().zoomPreviewOut() },
  {
    combos: [SHORTCUTS.fitPage],
    run: () => useUiStore.getState().setPreviewZoom(PREVIEW_DEFAULT_ZOOM),
  },
  {
    combos: [SHORTCUTS.toggleTheme],
    run: () => {
      const isDark = document.documentElement.classList.contains('dark');
      useUiStore.getState().setTheme(isDark ? 'light' : 'dark');
    },
    worksOverSurface: true,
  },
];

function useShortcuts() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isSurfaceUp = useOverlayStore.getState().surface !== null;
      if (isUndoKey(event) || isRedoKey(event)) {
        if (isTypingField(event.target) || isSurfaceUp) return;
        event.preventDefault();
        // Reading an older version changes nothing, least of all out of sight.
        if (useOverlayStore.getState().preview) {
          showToast(READING_A_VERSION);
          return;
        }
        const resume = useResumeStore.getState();
        if (isUndoKey(event)) resume.undo();
        else resume.redo();
        return;
      }
      const shortcut = GLOBAL_SHORTCUTS.find(({ combos }) =>
        combos.some((combo) => matchesShortcut(event, combo))
      );
      if (!shortcut || (isSurfaceUp && !shortcut.worksOverSurface)) return;
      event.preventDefault();
      shortcut.run();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
