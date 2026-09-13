import { useState } from 'react';
import { Download, FileInput, Moon, Save, Settings, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MobileViewTabs } from '@/components/MobileViewTabs';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { shortcutLabel } from '@/lib/shortcuts';
import { showToast, useOverlayStore } from '@/stores/overlayStore';
import { useUIStore } from '@/stores/uiStore';
import { useDarkMode } from '@/lib/hooks/useDarkMode';
import { ExportDialog } from '@/features/export/ExportDialog';
import { useResumeExport } from '@/features/export/useResumeExport';
import { useActiveTemplate } from '@/features/templates/useActiveTemplate';
import { useTemplateStatus } from '@/features/templates/useTemplateStatus';
import { TemplateStatusBadge } from '@/features/templates/TemplateStatusBadge';
import { SettingsDialog } from '@/features/settings/SettingsDialog';

const MOBILE_PANE_OPTIONS = [
  { value: 'editor' as const, label: 'Edit' },
  { value: 'preview' as const, label: 'Preview' },
];

export function TopBar() {
  const mobilePane = useUIStore((s) => s.mobilePane);
  const setMobilePane = useUIStore((s) => s.setMobilePane);
  const isMobile = useIsMobile();
  const { darkMode, toggleDarkMode } = useDarkMode();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const activeTemplate = useActiveTemplate();
  const templateStatus = useTemplateStatus();
  const openImport = useOverlayStore((s) => s.openImport);
  const setNameVersionOpen = useOverlayStore((s) => s.setNameVersionOpen);
  const {
    feedback,
    defaultPdfFileName,
    exportSummary,
    isPdfBusy,
    isSavingPdf,
    handleCopyMarkdown,
    handleCopyPlaintext,
    handleExportJsonResume,
    handleExportPdf,
  } = useResumeExport();

  return (
    <>
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-card px-3 md:px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-amber-500 text-sm font-bold text-white">
            M
          </div>
          <span className="text-base font-semibold tracking-wide text-zinc-900 dark:text-zinc-100">
            Mosaic
          </span>
          <span className="hidden text-sm font-medium text-zinc-600 md:inline">/</span>
          <div className="hidden min-w-0 items-center gap-2 md:flex">
            <span className="max-w-[28vw] truncate text-sm font-medium text-zinc-600 dark:text-zinc-400">
              {activeTemplate?.name ?? 'No resume open'}
            </span>
            <TemplateStatusBadge status={templateStatus} />
            {activeTemplate && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setNameVersionOpen(true)}
                title={`${
                  templateStatus === 'edited'
                    ? 'Give this state a name so you can find it in history'
                    : 'Name the newest version so you can find it in history'
                }  ${shortcutLabel('S')}`}
              >
                <Save className="size-3" />
                Name version…
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {feedback && (
            <span
              className={cn(
                'hidden pr-1 text-xs font-medium md:inline',
                feedback.tone === 'success'
                  ? 'text-zinc-600 dark:text-zinc-300'
                  : 'text-red-700 dark:text-red-400'
              )}
            >
              {feedback.message}
            </span>
          )}

          {isMobile && (
            <MobileViewTabs
              value={mobilePane}
              onChange={setMobilePane}
              options={MOBILE_PANE_OPTIONS}
            />
          )}

          <Button variant="ghost" size="icon-sm" onClick={toggleDarkMode} aria-label="Toggle theme">
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => openImport(!activeTemplate)}
            aria-label="Import resume"
          >
            <FileInput className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setIsSettingsOpen(true)}
            aria-label="Open settings"
          >
            <Settings className="h-4 w-4" />
          </Button>

          <Button
            size="sm"
            onClick={() =>
              activeTemplate ? setIsExportOpen(true) : showToast('Nothing to export yet')
            }
            disabled={isPdfBusy}
            aria-label="Open export dialog"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">{isSavingPdf ? 'Saving...' : 'Export'}</span>
          </Button>
        </div>
      </header>

      <SettingsDialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
      <ExportDialog
        // Remount when the suggested filename changes so the input resets cleanly.
        key={defaultPdfFileName}
        open={isExportOpen}
        onOpenChange={setIsExportOpen}
        defaultPdfFileName={defaultPdfFileName}
        exportSummary={exportSummary}
        isPdfBusy={isPdfBusy}
        isSavingPdf={isSavingPdf}
        handleExportPdf={handleExportPdf}
        handleCopyMarkdown={handleCopyMarkdown}
        handleCopyPlaintext={handleCopyPlaintext}
        handleExportJsonResume={handleExportJsonResume}
      />
    </>
  );
}
