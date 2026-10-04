import {
  AppSelect,
  AppSelectContent,
  AppSelectItem,
  AppSelectTrigger,
  AppSelectValue,
} from '@/components/AppSelect';
import { shortcutLabel } from '@/lib/keyboardShortcuts';
import {
  UNDO_HISTORY_STEP_OPTIONS,
  useUiStore,
  type LaunchView,
  type UndoHistorySteps,
} from '@/stores/uiStore';
import { AlwaysOn, SettingRow } from '../SettingRow';

const LAUNCH_VIEW_OPTIONS: { value: LaunchView; label: string }[] = [
  { value: 'last', label: 'Last template used' },
  { value: 'start', label: 'Start a new resume' },
  { value: 'templates', label: 'Template picker' },
];

export function GeneralSection() {
  const openOnLaunch = useUiStore((s) => s.openOnLaunch);
  const setOpenOnLaunch = useUiStore((s) => s.setOpenOnLaunch);
  const undoHistorySteps = useUiStore((s) => s.undoHistorySteps);
  const setUndoHistorySteps = useUiStore((s) => s.setUndoHistorySteps);

  return (
    <>
      <SettingRow
        label="Open on launch"
        description="What Mosaic shows when you start it. The last template you had open is always loaded behind it."
      >
        <AppSelect
          value={openOnLaunch}
          onValueChange={(value) => setOpenOnLaunch(value as LaunchView)}
        >
          <AppSelectTrigger className="w-44" aria-label="Open on launch">
            <AppSelectValue />
          </AppSelectTrigger>
          <AppSelectContent>
            {LAUNCH_VIEW_OPTIONS.map((option) => (
              <AppSelectItem key={option.value} value={option.value}>
                {option.label}
              </AppSelectItem>
            ))}
          </AppSelectContent>
        </AppSelect>
      </SettingRow>
      <SettingRow
        label="Autosave"
        description="Every edit is saved on your computer as you type. Name a version when you want to find a state again."
      >
        <AlwaysOn />
      </SettingRow>
      <SettingRow
        label="Undo history"
        description={`Steps ${shortcutLabel('Z')} can take back in the open resume. Named versions are kept either way.`}
      >
        <AppSelect
          value={String(undoHistorySteps)}
          onValueChange={(value) => setUndoHistorySteps(Number(value) as UndoHistorySteps)}
        >
          <AppSelectTrigger className="w-24" aria-label="Undo history">
            <AppSelectValue />
          </AppSelectTrigger>
          <AppSelectContent>
            {UNDO_HISTORY_STEP_OPTIONS.map((steps) => (
              <AppSelectItem key={steps} value={String(steps)}>
                {steps}
              </AppSelectItem>
            ))}
          </AppSelectContent>
        </AppSelect>
      </SettingRow>
    </>
  );
}
