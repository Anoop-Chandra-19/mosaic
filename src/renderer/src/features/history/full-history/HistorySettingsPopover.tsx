import { Settings } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { AppCheckbox } from '@/components/AppCheckbox';
import { AppPopover, AppPopoverContent, AppPopoverTrigger } from '@/components/AppPopover';
import { AppToggleGroup, AppToggleGroupItem } from '@/components/AppToggleGroup';
import { Text } from '@/components/Text';
import { useShortcutLabel } from '@/features/shortcuts/shortcutBindings';
import { useUiStore } from '@/stores/uiStore';
import {
  FOLD_NOTE,
  FOLD_OPTIONS,
  SNAPSHOT_TRIGGER_OPTIONS,
  SNAPSHOTS_INTRO,
} from '../snapshotSettings';

const DETAIL_OPTIONS = [
  { value: 'simple', label: 'Simple', note: 'The page, the change list and Restore.' },
  {
    value: 'all',
    label: 'All details',
    note: 'Adds the months index, counts on every row, and line numbers in Changes only.',
  },
] as const;

interface HistorySettingsPopoverProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

/** How much the history shows and when snapshots happen, in the history bar: never buried. */
export function HistorySettingsPopover({ isOpen, onOpenChange }: HistorySettingsPopoverProps) {
  const settingsKeys = useShortcutLabel('openSettings');
  return (
    <AppPopover open={isOpen} onOpenChange={onOpenChange}>
      <AppPopoverTrigger asChild>
        <AppButton
          variant="ghost"
          size="xs"
          title={`How much the history shows, and when automatic snapshots happen. App settings: ${settingsKeys}`}
          className="data-[state=open]:bg-line-strong data-[state=open]:text-foreground"
        >
          <Settings />
          History settings
        </AppButton>
      </AppPopoverTrigger>
      <AppPopoverContent
        align="end"
        aria-label="History settings"
        // Escape closes the popover, not the history view behind it.
        onEscapeKeyDown={(event) => event.stopPropagation()}
        className="w-80 px-3.5"
      >
        <Text as="h2" variant="caption" className="mb-2 block font-strong">
          History settings
        </Text>
        <DetailSettings />
        <div aria-hidden className="my-3 h-px bg-line" />
        <SnapshotSettings />
      </AppPopoverContent>
    </AppPopover>
  );
}

function DetailSettings() {
  const isDetailed = useUiStore((s) => s.shouldShowHistoryDetails);
  const setIsDetailed = useUiStore((s) => s.setShouldShowHistoryDetails);
  const shown = DETAIL_OPTIONS[isDetailed ? 1 : 0];
  return (
    <>
      <Text as="h3" variant="strong">
        Show
      </Text>
      <AppToggleGroup
        type="single"
        size="sm"
        value={shown.value}
        onValueChange={(value) => value && setIsDetailed(value === 'all')}
        aria-label="Show"
        className="mt-1.5 p-0.5"
      >
        {DETAIL_OPTIONS.map(({ value, label }) => (
          <AppToggleGroupItem key={value} value={value}>
            {label}
          </AppToggleGroupItem>
        ))}
      </AppToggleGroup>
      <Text as="p" variant="secondary" className="mt-1.5 text-pretty text-ink-faint">
        {shown.note}
      </Text>
    </>
  );
}

function SnapshotSettings() {
  const triggers = useUiStore((s) => s.snapshotTriggers);
  const setTrigger = useUiStore((s) => s.setSnapshotTrigger);
  const foldDays = useUiStore((s) => s.foldSnapshotsAfterDays);
  const setFoldDays = useUiStore((s) => s.setFoldSnapshotsAfterDays);
  return (
    <>
      <Text as="h3" variant="strong">
        Automatic snapshots
      </Text>
      <Text as="p" variant="secondary" className="mt-1 mb-2 text-pretty text-ink-faint">
        {SNAPSHOTS_INTRO}
      </Text>
      {SNAPSHOT_TRIGGER_OPTIONS.map(({ trigger, label, description }) => (
        <label key={trigger} className="flex cursor-pointer items-start gap-2.25 py-1.5">
          <AppCheckbox
            size="sm"
            checked={triggers[trigger]}
            onCheckedChange={(checked) => setTrigger(trigger, checked === true)}
            className="mt-0.5"
          />
          <span>
            <Text variant="secondary" className="block text-ink-soft">
              {label}
            </Text>
            {description && (
              <Text variant="caption" className="mt-px block">
                {description}
              </Text>
            )}
          </span>
        </label>
      ))}
      <Text as="h3" variant="strong" className="mt-3 block">
        Fold old automatic snapshots
      </Text>
      <AppToggleGroup
        type="single"
        size="sm"
        value={String(foldDays)}
        onValueChange={(value) =>
          value && setFoldDays(FOLD_OPTIONS.find((option) => String(option.days) === value)!.days)
        }
        aria-label="Fold old automatic snapshots"
        className="mt-1.5 p-0.5"
      >
        {FOLD_OPTIONS.map(({ days, label }) => (
          <AppToggleGroupItem key={label} value={String(days)}>
            {label}
          </AppToggleGroupItem>
        ))}
      </AppToggleGroup>
      <Text as="p" variant="secondary" className="mt-1.5 text-pretty text-ink-faint">
        {FOLD_NOTE}
      </Text>
    </>
  );
}
