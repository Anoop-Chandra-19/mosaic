import { Download, Moon, Redo2, Save, Settings, Sun, Undo2, Upload } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { MosaicMark } from '@/components/MosaicMark';
import { Text } from '@/components/Text';
import { redoShortcutLabel, shortcutLabel } from '@/lib/keyboardShortcuts';
import { showToast, useOverlayStore } from '@/stores/overlayStore';
import { useResumeStore } from '@/stores/resumeStore';
import { useIsDarkTheme } from './useAppearance';
import { useUiStore } from '@/stores/uiStore';
import { useActiveTemplate } from '@/features/templates/useActiveTemplate';
import { useTemplateStatus } from '@/features/templates/useTemplateStatus';
import { TemplateStatusBadge } from '@/features/templates/TemplateStatusBadge';
import { tourTargetProps } from '@/features/onboarding/tourSteps';
import { useShortcutLabel } from '@/features/shortcuts/shortcutBindings';

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
  const nameVersionKeys = useShortcutLabel('nameVersion');
  const settingsKeys = useShortcutLabel('openSettings');
  const previewing = useOverlayStore((s) => s.preview !== null);

  return (
    <header className="flex h-[3.125rem] shrink-0 items-center justify-between gap-3 border-b border-line bg-background pr-2.5 pl-3">
      <div className="flex min-w-0 items-center gap-2.25">
        <MosaicMark size="sm" />
        <Text variant="editor">Mosaic</Text>
        <Text variant="body" className="text-ink-faint">
          /
        </Text>
        <div className="flex min-w-0 items-center gap-2">
          <Text variant="body" className="max-w-[28vw] truncate font-control text-foreground">
            {activeTemplate?.name ?? 'No resume open'}
          </Text>
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
              }  ${nameVersionKeys}`.trim()}
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
          {...tourTargetProps('settings')}
          aria-label="Open settings"
          title={`Settings  ${settingsKeys}`.trim()}
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
