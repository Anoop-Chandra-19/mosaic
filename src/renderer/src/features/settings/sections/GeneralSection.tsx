import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
        <Select
          value={openOnLaunch}
          onValueChange={(value) => setOpenOnLaunch(value as LaunchView)}
        >
          <SelectTrigger size="sm" className="w-44" aria-label="Open on launch">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LAUNCH_VIEW_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingRow>
      <SettingRow
        label="Autosave"
        description="Every edit is saved on this machine as you type. Name a version when you want to find a state again."
      >
        <AlwaysOn />
      </SettingRow>
      <SettingRow
        label="Undo history"
        description={`Steps ${shortcutLabel('Z')} can take back in the open resume. Version history keeps everything either way.`}
      >
        <Select
          value={String(undoHistorySteps)}
          onValueChange={(value) => setUndoHistorySteps(Number(value) as UndoHistorySteps)}
        >
          <SelectTrigger size="sm" className="w-24" aria-label="Undo history">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {UNDO_HISTORY_STEP_OPTIONS.map((steps) => (
              <SelectItem key={steps} value={String(steps)}>
                {steps}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingRow>
    </>
  );
}
