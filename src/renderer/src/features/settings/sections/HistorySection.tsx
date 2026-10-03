import {
  FOLD_NOTE,
  FOLD_OPTIONS,
  SNAPSHOT_TRIGGER_OPTIONS,
  SNAPSHOTS_INTRO,
} from '@/features/history/snapshotSettings';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useUiStore } from '@/stores/uiStore';
import { SettingRow } from '../SettingRow';

const HEADING = 'pt-2.5 pb-1 text-[0.65rem] font-bold tracking-wider text-ink-faint uppercase';

export function HistorySection() {
  const isDetailed = useUiStore((s) => s.shouldShowHistoryDetails);
  const setIsDetailed = useUiStore((s) => s.setShouldShowHistoryDetails);
  const triggers = useUiStore((s) => s.snapshotTriggers);
  const setTrigger = useUiStore((s) => s.setSnapshotTrigger);
  const foldDays = useUiStore((s) => s.foldSnapshotsAfterDays);
  const setFoldDays = useUiStore((s) => s.setFoldSnapshotsAfterDays);
  return (
    <>
      <h3 className={HEADING}>Automatic snapshots</h3>
      <p className="pb-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
        {SNAPSHOTS_INTRO}
      </p>
      {SNAPSHOT_TRIGGER_OPTIONS.map(({ trigger, label, description }) => (
        <SettingRow key={trigger} label={label} description={description}>
          <Switch
            checked={triggers[trigger]}
            onCheckedChange={(isOn) => setTrigger(trigger, isOn)}
            aria-label={label}
          />
        </SettingRow>
      ))}
      <SettingRow label="Fold old automatic snapshots" description={FOLD_NOTE}>
        <Select
          value={String(foldDays)}
          onValueChange={(value) =>
            setFoldDays(FOLD_OPTIONS.find((option) => String(option.days) === value)!.days)
          }
        >
          <SelectTrigger size="sm" className="w-36" aria-label="Fold old automatic snapshots">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FOLD_OPTIONS.map(({ days, label }) => (
              <SelectItem key={label} value={String(days)}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingRow>
      <h3 className={HEADING}>Full history</h3>
      <SettingRow
        label="Always show all details"
        description="Adds the months index, symbol counts, and line numbers in Changes only. Off, counts read in words."
      >
        <Switch
          checked={isDetailed}
          onCheckedChange={setIsDetailed}
          aria-label="Always show all details"
        />
      </SettingRow>
    </>
  );
}
