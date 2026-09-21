import { useEffect } from 'react';
import { READING_A_VERSION, TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { StatusBar } from './StatusBar';
import { PreviewPanel } from './PreviewPanel';
import { Toast } from './Toast';
import { AgentPane } from '@/features/agent/AgentPane';
import { RestoreBackupDialog } from '@/features/backup/RestoreBackupDialog';
import { ExportDialog } from '@/features/export/ExportDialog';
import { ImportResumeDialog } from '@/features/import/ImportResumeDialog';
import { SettingsDialog } from '@/features/settings/SettingsDialog';
import { StartPanel } from '@/features/start/StartPanel';
import { NameVersionDialog } from '@/features/templates/NameVersionDialog';
import { useAutoSnapshot } from '@/features/templates/useAutoSnapshot';
import { isModKey, isRedoKey, isTypingField, isUndoKey } from '@/lib/keyboardShortcuts';
import { useAiStore } from '@/stores/aiStore';
import { showToast, useOverlayStore } from '@/stores/overlayStore';
import { useResumeStore } from '@/stores/resumeStore';
import { useTemplateStore } from '@/stores/templateStore';
import { useUiStore } from '@/stores/uiStore';
import { useApplyTheme } from '@/lib/hooks/useTheme';

export function AppShell() {
  useApplyTheme();
  useShortcuts();
  useAutoSnapshot();
  const hasTemplates = useTemplateStore((s) => s.templates.length > 0);
  const showStart = useOverlayStore((s) => s.startOpen);
  const aiEnabled = useAiStore((s) => s.enabled);
  const agentPaneOpen = useUiStore((s) => s.agentPaneOpen);
  const showAgentPane = aiEnabled && agentPaneOpen;
  const shouldShowPreview = useUiStore((s) => s.shouldShowPreview);

  return (
    // Editor and preview side by side, at every window size; the assistant joins them on
    // the right when AI is on.
    <div className="flex h-screen flex-col">
      <TopBar />
      <div className="relative flex flex-1 overflow-hidden">
        {/* Behind the Start panel the workspace is visible but out of reach. */}
        <div
          className="relative flex flex-1 overflow-hidden @container/workspace"
          inert={showStart}
        >
          <Sidebar />
          {shouldShowPreview && <PreviewPanel />}
          {showAgentPane && <AgentPane />}
        </div>
        {showStart && <StartPanel closable={hasTemplates} />}
        <Toast />
      </div>
      <StatusBar />
      <SettingsDialog />
      <ImportResumeDialog />
      <RestoreBackupDialog />
      <ExportDialog />
      <NameVersionDialog />
    </div>
  );
}

/**
 * Ctrl/⌘+S names a version — the draft itself is always saved already. Ctrl/⌘+Z undoes and
 * Ctrl/⌘+Shift+Z (or Ctrl+Y) redoes, except while a field is being typed in, where the
 * browser's own undo belongs to that field. Ctrl/⌘+B shows or hides the sidebar, Ctrl/⌘+\
 * the assistant while AI is on, and Ctrl/⌘+, opens Settings.
 */
function useShortcuts() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isUndoKey(event) || isRedoKey(event)) {
        if (isTypingField(event.target)) return;
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
      if (!isModKey(event)) return;
      if (event.key === ',') {
        event.preventDefault();
        useOverlayStore.getState().openSettings();
        return;
      }
      if (event.key.toLowerCase() === 'b') {
        event.preventDefault();
        if (useUiStore.getState().shouldShowPreview) useUiStore.getState().toggleSidebarCollapsed();
        return;
      }
      if (event.key === '\\' && useAiStore.getState().enabled) {
        event.preventDefault();
        useUiStore.getState().toggleAgentPane();
        return;
      }
      if (event.key.toLowerCase() !== 's') return;
      event.preventDefault();
      if (useResumeStore.getState().templateId !== null) {
        useOverlayStore.getState().setNameVersionOpen(true);
      } else {
        showToast('Nothing is open. Start a resume first.');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
