import { useEffect } from 'react';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { PreviewPanel } from './PreviewPanel';
import { Toast } from './Toast';
import { RestoreBackupDialog } from '@/features/backup/RestoreBackupDialog';
import { ExportDialog } from '@/features/export/ExportDialog';
import { ImportResumeDialog } from '@/features/import/ImportResumeDialog';
import { StartPanel } from '@/features/start/StartPanel';
import { NameVersionDialog } from '@/features/templates/NameVersionDialog';
import { isModKey } from '@/lib/shortcuts';
import { showToast, useOverlayStore } from '@/stores/overlayStore';
import { useResumeStore } from '@/stores/resumeStore';
import { useTemplateStore } from '@/stores/templateStore';
import { useDarkMode } from '@/lib/hooks/useDarkMode';

export function AppShell() {
  useDarkMode();
  useNameVersionShortcut();
  const hasTemplates = useTemplateStore((s) => s.templates.length > 0);
  const showStart = useOverlayStore((s) => s.startOpen);

  return (
    // Editor and preview side by side, at every window size.
    <div className="flex h-screen flex-col">
      <TopBar />
      <div className="relative flex flex-1 overflow-hidden">
        {/* Behind the Start panel the workspace is visible but out of reach. */}
        <div className="flex flex-1 overflow-hidden" inert={showStart}>
          <Sidebar />
          <PreviewPanel />
        </div>
        {showStart && <StartPanel closable={hasTemplates} />}
        <Toast />
      </div>
      <ImportResumeDialog />
      <RestoreBackupDialog />
      <ExportDialog />
      <NameVersionDialog />
    </div>
  );
}

/** Ctrl/⌘+S names a version — the draft itself is always saved already. */
function useNameVersionShortcut() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isModKey(event) || event.key.toLowerCase() !== 's') return;
      event.preventDefault();
      if (useResumeStore.getState().templateId !== null) {
        useOverlayStore.getState().setNameVersionOpen(true);
      } else {
        showToast('Nothing open — start a resume first');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
