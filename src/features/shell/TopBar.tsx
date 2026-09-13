import { useState } from 'react';
import { Download, FileInput, Moon, Save, Settings, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { shortcutLabel } from '@/lib/shortcuts';
import { showToast, useOverlayStore } from '@/stores/overlayStore';
import { useDarkMode } from '@/lib/hooks/useDarkMode';
import { useActiveTemplate } from '@/features/templates/useActiveTemplate';
import { useTemplateStatus } from '@/features/templates/useTemplateStatus';
import { TemplateStatusBadge } from '@/features/templates/TemplateStatusBadge';
import { SettingsDialog } from '@/features/settings/SettingsDialog';

export function TopBar() {
  const { darkMode, toggleDarkMode } = useDarkMode();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const openExport = useOverlayStore((s) => s.openExport);
  const activeTemplate = useActiveTemplate();
  const templateStatus = useTemplateStatus();
  const openImport = useOverlayStore((s) => s.openImport);
  const setNameVersionOpen = useOverlayStore((s) => s.setNameVersionOpen);

  return (
    <>
      <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-amber-500 text-sm font-bold text-white">
            M
          </div>
          <span className="text-base font-semibold tracking-wide text-zinc-900 dark:text-zinc-100">
            Mosaic
          </span>
          <span className="text-sm font-medium text-zinc-600">/</span>
          <div className="flex min-w-0 items-center gap-2">
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

        <div className="flex shrink-0 items-center gap-1.5">
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
            onClick={() => (activeTemplate ? openExport() : showToast('Nothing to export yet'))}
            aria-label="Open export dialog"
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </header>

      <SettingsDialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
    </>
  );
}
