import { Switch } from '@/components/ui/switch';
import { useUiStore } from '@/stores/uiStore';
import { SettingRow } from '../SettingRow';

export function HistorySection() {
  const isDetailed = useUiStore((s) => s.shouldShowHistoryDetails);
  const setIsDetailed = useUiStore((s) => s.setShouldShowHistoryDetails);
  return (
    <>
      <h3 className="pt-2.5 pb-1 text-[0.65rem] font-bold tracking-wider text-ink-faint uppercase">
        Full history
      </h3>
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
