import { Download, Moon, Redo2, Save, Settings, Sun, Undo2, Upload } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { redoShortcutLabel, shortcutLabel } from '@/lib/keyboardShortcuts';
import { showToast, useOverlayStore } from '@/stores/overlayStore';
import { useResumeStore } from '@/stores/resumeStore';
import { useIsDarkTheme } from '@/lib/hooks/useTheme';
import { useUiStore } from '@/stores/uiStore';
import { useActiveTemplate } from '@/features/templates/useActiveTemplate';
import { useTemplateStatus } from '@/features/templates/useTemplateStatus';
import { TemplateStatusBadge } from '@/features/templates/TemplateStatusBadge';
import { tourTargetProps } from '@/features/onboarding/tourSteps';

/** Reading an older version is a read mode: the draft is left where it is. */
export const READING_A_VERSION = 'Go back to your draft to edit it.';

export function TopBar() {
  const isDark = useIsDarkTheme();
  const setTheme = useUiStore((s) => s.setTheme);
  const openSettings = useOverlayStore((s) => s.openSettings);
  const openExport = useOverlayStore((s) => s.openExport);
  const activeTemplate = useActiveTemplate();
  const templateStatus = useTemplateStatus();
  const openImport = useOverlayStore((s) => s.openImport);
  const setNameVersionOpen = useOverlayStore((s) => s.setNameVersionOpen);
  const undoLabel = useResumeStore((s) => s.undoLabel);
  const redoLabel = useResumeStore((s) => s.redoLabel);
  const undo = useResumeStore((s) => s.undo);
  const redo = useResumeStore((s) => s.redo);
  const previewing = useOverlayStore((s) => s.preview !== null);

  return (
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
            <AppButton
              variant="outline"
              size="xs"
              onClick={() => setNameVersionOpen(true)}
              {...tourTargetProps('nameVersion')}
              title={`${
                templateStatus === 'edited'
                  ? 'Give this state a name so you can find it in history'
                  : 'Name the newest version so you can find it in history'
              }  ${shortcutLabel('S')}`}
            >
              <Save className="size-3" />
              Name version…
            </AppButton>
          )}
        </div>
      </div>

      {/* As in the design: undo and redo, Settings, then the theme and the file actions. */}
      <div className="flex shrink-0 items-center gap-1.5">
        <AppButton
          variant="ghost"
          size="sm"
          shape="square"
          onClick={undo}
          disabled={previewing || undoLabel === null}
          aria-label="Undo"
          title={
            previewing
              ? READING_A_VERSION
              : `${undoLabel ? `Undo ${undoLabel}` : 'Nothing to undo'}  ${shortcutLabel('Z')}`
          }
        >
          <Undo2 className="h-4 w-4" />
        </AppButton>
        <AppButton
          variant="ghost"
          size="sm"
          shape="square"
          onClick={redo}
          disabled={previewing || redoLabel === null}
          aria-label="Redo"
          title={
            previewing
              ? READING_A_VERSION
              : `${redoLabel ? `Redo ${redoLabel}` : 'Nothing to redo'}  ${redoShortcutLabel()}`
          }
        >
          <Redo2 className="h-4 w-4" />
        </AppButton>
        <span aria-hidden className="mx-0.5 h-4.5 w-px bg-line-strong" />

        <AppButton
          variant="ghost"
          size="sm"
          shape="square"
          onClick={() => openSettings()}
          aria-label="Open settings"
          title={`Settings  ${shortcutLabel(',')}`}
        >
          <Settings className="h-4 w-4" />
        </AppButton>
        <span aria-hidden className="mx-0.5 h-4.5 w-px bg-line-strong" />

        <AppButton
          variant="ghost"
          size="sm"
          shape="square"
          // A choice made here is a choice: it leaves System for the theme it switches to.
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          aria-label="Toggle theme"
          title={isDark ? 'Light theme' : 'Dark theme'}
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </AppButton>

        <AppButton
          variant="outline"
          size="sm"
          onClick={() => openImport(!activeTemplate)}
          aria-label="Import resume"
        >
          <Upload />
          Import
        </AppButton>

        <AppButton
          size="sm"
          onClick={() => (activeTemplate ? openExport() : showToast('Nothing to export yet'))}
          aria-label="Open export dialog"
          {...tourTargetProps('export')}
        >
          <Download className="h-4 w-4" />
          Export
        </AppButton>
      </div>
    </header>
  );
}
