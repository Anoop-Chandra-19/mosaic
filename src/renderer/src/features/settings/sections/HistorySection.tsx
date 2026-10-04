import { FOLD_OPTIONS, SNAPSHOT_TRIGGER_OPTIONS } from '@/features/history/snapshotSettings';
import {
  AppSelect,
  AppSelectContent,
  AppSelectItem,
  AppSelectTrigger,
  AppSelectValue,
} from '@/components/AppSelect';
import { AppSwitch } from '@/components/AppSwitch';
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
      {SNAPSHOT_TRIGGER_OPTIONS.map(({ trigger, label, description }) => (
        <SettingRow key={trigger} label={label} description={description}>
          <AppSwitch
            checked={triggers[trigger]}
            onCheckedChange={(isOn) => setTrigger(trigger, isOn)}
            aria-label={label}
          />
        </SettingRow>
      ))}
      <h3 className={HEADING}>Full history</h3>
      <SettingRow
        label="Always show all details"
        description="Adds the months index, per-row change counts, and line numbers in Changes only. Off, counts read in words."
      >
        <AppSwitch
          checked={isDetailed}
          onCheckedChange={setIsDetailed}
          aria-label="Always show all details"
        />
      </SettingRow>
      <h3 className={HEADING}>Keeping</h3>
      <SettingRow
        label="Fold old automatic snapshots"
        description="Folded rows stay in the list as one expandable row. Nothing is deleted. Named versions never fold."
      >
        <AppSelect
          value={String(foldDays)}
          onValueChange={(value) =>
            setFoldDays(FOLD_OPTIONS.find((option) => String(option.days) === value)!.days)
          }
        >
          <AppSelectTrigger className="w-36" aria-label="Fold old automatic snapshots">
            <AppSelectValue />
          </AppSelectTrigger>
          <AppSelectContent>
            {FOLD_OPTIONS.map(({ days, label }) => (
              <AppSelectItem key={label} value={String(days)}>
                {label}
              </AppSelectItem>
            ))}
          </AppSelectContent>
        </AppSelect>
      </SettingRow>
    </>
  );
}
