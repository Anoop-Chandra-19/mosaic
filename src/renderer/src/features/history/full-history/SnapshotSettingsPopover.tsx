import { Settings } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { AppCheckbox } from '@/components/AppCheckbox';
import { AppPopover, AppPopoverContent, AppPopoverTrigger } from '@/components/AppPopover';
import { AppToggleGroup, AppToggleGroupItem } from '@/components/AppToggleGroup';
import { Text } from '@/components/Text';
import { useUiStore } from '@/stores/uiStore';
import {
  FOLD_NOTE,
  FOLD_OPTIONS,
  SNAPSHOT_TRIGGER_OPTIONS,
  SNAPSHOTS_INTRO,
} from '../snapshotSettings';

interface SnapshotSettingsPopoverProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

/** When automatic snapshots happen, in the history bar: never buried in the index. */
export function SnapshotSettingsPopover({ isOpen, onOpenChange }: SnapshotSettingsPopoverProps) {
  const triggers = useUiStore((s) => s.snapshotTriggers);
  const setTrigger = useUiStore((s) => s.setSnapshotTrigger);
  const foldDays = useUiStore((s) => s.foldSnapshotsAfterDays);
  const setFoldDays = useUiStore((s) => s.setFoldSnapshotsAfterDays);

  return (
    <AppPopover open={isOpen} onOpenChange={onOpenChange}>
      <AppPopoverTrigger asChild>
        <AppButton
          variant="ghost"
          size="xs"
          title="When automatic snapshots happen"
          className="data-[state=open]:bg-line-strong data-[state=open]:text-foreground"
        >
          <Settings />
          Automatic snapshots
        </AppButton>
      </AppPopoverTrigger>
      <AppPopoverContent
        align="end"
        aria-label="Automatic snapshots"
        // Escape closes the popover, not the history view behind it.
        onEscapeKeyDown={(event) => event.stopPropagation()}
        className="w-80 px-3.5"
      >
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
                <Text variant="meta" className="mt-px block font-sans">
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
      </AppPopoverContent>
    </AppPopover>
  );
}
