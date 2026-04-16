import { useState } from 'react';
import { Moon, Sun, Settings, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MobileViewTabs } from '@/components/MobileViewTabs';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { useUIStore } from '@/stores/uiStore';
import { useDarkMode } from '@/lib/hooks/useDarkMode';
import { useResumeExport } from '@/lib/hooks/useResumeExport';
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
  const {
    feedback,
    isPdfBusy,
    isSavingPdf,
    isPreviewingPdf,
    handleCopyMarkdown,
    handleCopyPlaintext,
    handleExportPdf,
    handlePreviewPdf,
  } = useResumeExport();

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-500 font-bold text-white">
            M
          </div>
          <span className="text-lg font-semibold">Mosaic</span>
        </div>

        <div className="flex items-center gap-1">
          {feedback && (
            <span
              className={cn(
                'hidden pr-1 text-xs font-medium md:inline',
                feedback.tone === 'success' ? 'text-zinc-600 dark:text-zinc-300' : 'text-red-700'
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

          <Button variant="ghost" size="icon" onClick={toggleDarkMode} aria-label="Toggle theme">
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSettingsOpen(true)}
            aria-label="Open settings"
          >
            <Settings className="h-4 w-4" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Export resume">
                <Download className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled={isPdfBusy} onSelect={handleExportPdf}>
                {isSavingPdf ? 'Saving PDF...' : 'Export as PDF'}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={isPdfBusy} onSelect={handlePreviewPdf}>
                {isPreviewingPdf ? 'Opening preview...' : 'Preview PDF'}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleCopyMarkdown}>Copy as Markdown</DropdownMenuItem>
              <DropdownMenuItem onSelect={handleCopyPlaintext}>Copy as Plaintext</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <SettingsDialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
    </>
  );
}
