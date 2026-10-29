import { Suspense, useDeferredValue, useEffect, ViewTransition } from 'react';
import { READING_A_VERSION, TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { StatusBar } from './StatusBar';
import { PreviewPanel } from './PreviewPanel';
import { Toast } from './Toast';
import { AgentPane } from '@/features/agent/AgentPane';
import { useAnswerAgentToolCalls } from '@/features/agent/agentRunTools';
import { useFollowAgentRuns } from '@/features/agent/followAgentRuns';
import { DevTools } from '@/features/dev-tools/DevTools';
import { SuggestionReview } from '@/features/suggestions/review/SuggestionReview';
import { RestoreBackupDialog } from '@/features/backup/RestoreBackupDialog';
import { ExportDialog } from '@/features/export/ExportDialog';
import { FullHistory } from '@/features/history/full-history/FullHistory';
import { ImportResumeDialog } from '@/features/import/ImportResumeDialog';
import { SettingsDialog } from '@/features/settings/SettingsDialog';
import { StartPanel } from '@/features/start/StartPanel';
import { NameVersionDialog } from '@/features/templates/NameVersionDialog';
import { useAutoSnapshot } from '@/features/templates/useAutoSnapshot';
import { useKeyboardNavigationMark } from '@/lib/hooks/useKeyboardNavigationMark';
import { GettingStartedTour } from '@/features/onboarding/getting-started/GettingStartedTour';
import { HistoryTour } from '@/features/onboarding/history/HistoryTour';
import {
  CUT_MOTION,
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
import { matchesAction } from '@/features/shortcuts/shortcutBindings';
import { isRedoKey, isTypingField, isUndoKey } from '@/lib/keyboardShortcuts';
import { SHORTCUT_PLACES, type ShortcutId, type ShortcutPlace } from '@/lib/shortcutCatalog';
import { useAgentSettingsStore } from '@/stores/agentSettingsStore';
import { useOverlayStore } from '@/stores/overlayStore';
import { usePreviewStore } from '@/stores/previewStore';
import { useTargetStore } from '@/stores/targetStore';
import { showToast } from '@/stores/toastStore';
import { useResumeStore } from '@/stores/resumeStore';
import { useTemplateStore } from '@/stores/templateStore';
import { PREVIEW_DEFAULT_ZOOM, useUiStore, type SidebarTab } from '@/stores/uiStore';
import { useApplyDensity, useApplyTheme } from './useAppearance';
import { useHelpMenu } from './useHelpMenu';

export function AppShell() {
  useApplyTheme();
  useApplyDensity();
  useShortcuts();
  useAutoSnapshot();
  useKeyboardNavigationMark();
  useHelpMenu();
  useAnswerAgentToolCalls();
  useFollowAgentRuns();
  const hasTemplates = useTemplateStore((s) => s.templates.length > 0);
  const surface = useOverlayStore((s) => s.surface);
  const shownSurface = useShownSurface();
  const isWorkspaceReplaced = useIsWorkspaceReplaced();
  const isAgentEnabled = useAgentSettingsStore((s) => s.enabled);
  const agentPaneOpen = useUiStore((s) => s.agentPaneOpen);
  const shouldShowPreview = useUiStore((s) => s.shouldShowPreview);
  // Deferred, like the surface, so hiding and showing them is a view transition.
  const isSidebarCollapsed = useDeferredValue(useUiStore((s) => s.sidebarCollapsed));
  const showAgentPane = useDeferredValue(isAgentEnabled && agentPaneOpen);

  return (
    // Editor and preview side by side, at every window size; the assistant joins them on
    // the right when AI is on.
    <div className="flex h-screen flex-col">
      {/* The review covers the top bar too: it has its own. The status bar stays. */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          inert={shownSurface?.kind === 'review'}
          // The review's own bar takes this one's place, in step.
          className={transitionClasses({
            name: 'bar',
            motion: 'lockstep',
            isActive: shownSurface?.kind !== 'review',
          })}
        >
          <TopBar />
        </div>
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
              <ViewTransition
                enter={SLIDE_AWAY_MOTION.start.in}
                exit={SLIDE_AWAY_MOTION.start.out}
                update="none"
              >
                <Sidebar />
              </ViewTransition>
            )}
            {shouldShowPreview && <PreviewPanel />}
            {showAgentPane && (
              <ViewTransition
                enter={SLIDE_AWAY_MOTION.end.in}
                exit={SLIDE_AWAY_MOTION.end.out}
                update="none"
              >
                <AgentPane />
              </ViewTransition>
            )}
          </div>
          {surface?.kind === 'start' && <StartPanel closable={hasTemplates} />}
          {/* Mounted from the start, so a surface still loading keeps the one before on screen. */}
          <Suspense fallback={null}>
            {shownSurface?.kind === 'history' && (
              <ViewTransition
                enter={SURFACE_MOTION.in}
                exit={SURFACE_MOTION.out}
                update={SURFACE_MOTION.in}
              >
                <FullHistory
                  opening={shownSurface}
                  templateId={shownSurface.templateId}
                  filter={shownSurface.filter}
                  versionId={shownSurface.versionId}
                  comparison={shownSurface.comparison}
                  view={shownSurface.view}
                />
              </ViewTransition>
            )}
          </Suspense>
          <Toast />
        </div>
        {shownSurface?.kind === 'review' && (
          // Its bar, page and inspector move on their own; this only starts the transition.
          <ViewTransition enter={CUT_MOTION} exit={CUT_MOTION} update="none">
            <SuggestionReview openOn={shownSurface.proposalId} />
          </ViewTransition>
        )}
      </div>
      <StatusBar />
      <SettingsDialog />
      <ImportResumeDialog />
      <RestoreBackupDialog />
      <ExportDialog />
      <NameVersionDialog />
      <ShortcutsDialog />
      <GettingStartedTour />
      <HistoryTour />
      {/* A constant per build, so a release build drops the tools entirely. */}
      {import.meta.env.MODE !== 'release' && <DevTools />}
    </div>
  );
}

const NOTHING_OPEN = 'Nothing is open. Start a resume first.';

/**
 * Where the keys were pressed, for the sheet to show that place's keys first: the area marked
 * `data-shortcut-place` that has focus (the innermost, so a bullet being edited beats the
 * sidebar around it), else the one under the pointer.
 */
function findShortcutPlace(): ShortcutPlace | null {
  const surface = useOverlayStore.getState().surface?.kind;
  if (surface === 'history' || surface === 'review') return surface;
  const area =
    document.activeElement?.closest<HTMLElement>('[data-shortcut-place]') ??
    document.querySelector<HTMLElement>('[data-shortcut-place]:hover');
  const place = SHORTCUT_PLACES.find((known) => known === area?.dataset.shortcutPlace);
  // The sidebar's keys are the editor's; on the Templates tab they would not apply.
  if (place === 'sidebar' && useUiStore.getState().activeSidebarTab !== 'content') return null;
  return place ?? null;
}

/** The sidebar, shown, on `tab`. */
function showSidebarTab(tab: SidebarTab) {
  const ui = useUiStore.getState();
  ui.setActiveSidebarTab(tab);
  if (ui.sidebarCollapsed) ui.toggleSidebarCollapsed();
}

/**
 * The shortcuts that work anywhere in the window, on the keys they are bound to now. Undo and redo leave a field
 * that is being typed in alone: the browser's own undo belongs to it. Ctrl/⌘+S names a
 * version; the draft itself is always saved already.
 *
 * While a surface covers the workspace, only those marked `worksOverSurface` run: the
 * rest act on the editor, and would change what is out of sight.
 */
const GLOBAL_SHORTCUTS: { id: ShortcutId; run: () => void; worksOverSurface?: true }[] = [
  {
    id: 'openSettings',
    run: () => useOverlayStore.getState().openSettings(),
    worksOverSurface: true,
  },
  {
    id: 'showShortcuts',
    run: () =>
      useOverlayStore.getState().openDialog({ kind: 'shortcuts', place: findShortcutPlace() }),
    worksOverSurface: true,
  },
  {
    id: 'toggleSidebar',
    run: () => {
      if (useUiStore.getState().shouldShowPreview) useUiStore.getState().toggleSidebarCollapsed();
    },
  },
  {
    id: 'toggleAssistant',
    run: () => {
      if (useAgentSettingsStore.getState().enabled) useUiStore.getState().toggleAgentPane();
    },
  },
  {
    id: 'nameVersion',
    run: () => {
      if (useResumeStore.getState().templateId === null) showToast(NOTHING_OPEN);
      else useOverlayStore.getState().openDialog({ kind: 'nameVersion' });
    },
  },
  // Opens the open template's history, and closes it again: a view you toggle, like a pane.
  {
    id: 'showHistory',
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
    id: 'newTemplate',
    run: () => useOverlayStore.getState().openSurface({ kind: 'start' }),
    worksOverSurface: true,
  },
  { id: 'switchTemplate', run: () => showSidebarTab('templates') },
  {
    id: 'exportResume',
    run: () => {
      if (useResumeStore.getState().templateId === null) showToast(NOTHING_OPEN);
      else useOverlayStore.getState().openDialog({ kind: 'export', version: null });
    },
  },
  {
    id: 'importResume',
    run: () =>
      useOverlayStore.getState().openDialog({
        kind: 'import',
        asNewOnly: useResumeStore.getState().templateId === null,
      }),
    worksOverSurface: true,
  },
  {
    id: 'newSection',
    run: () => {
      if (useResumeStore.getState().templateId === null) return showToast(NOTHING_OPEN);
      if (usePreviewStore.getState().preview) return showToast(READING_A_VERSION);
      showSidebarTab('content');
      // An empty resume suggests its sections in place of the menu, so those are shown.
      const isEmpty = useResumeStore
        .getState()
        .sections.every((section) => section.items.length === 0);
      if (!isEmpty) useTargetStore.getState().requestTarget('addSectionMenu');
    },
  },
  { id: 'zoomIn', run: () => useUiStore.getState().zoomPreviewIn() },
  { id: 'zoomOut', run: () => useUiStore.getState().zoomPreviewOut() },
  {
    id: 'fitPage',
    run: () => useUiStore.getState().setPreviewZoom(PREVIEW_DEFAULT_ZOOM),
  },
  {
    id: 'toggleTheme',
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
        if (usePreviewStore.getState().preview) {
          showToast(READING_A_VERSION);
          return;
        }
        const resume = useResumeStore.getState();
        if (isUndoKey(event)) resume.undo();
        else resume.redo();
        return;
      }
      const shortcut = GLOBAL_SHORTCUTS.find(({ id }) => matchesAction(event, id));
      if (!shortcut || (isSurfaceUp && !shortcut.worksOverSurface)) return;
      event.preventDefault();
      shortcut.run();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
