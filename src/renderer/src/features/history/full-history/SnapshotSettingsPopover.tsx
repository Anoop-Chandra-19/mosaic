import { Settings } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { AppCheckbox } from '@/components/AppCheckbox';
import { AppPopover, AppPopoverContent, AppPopoverTrigger } from '@/components/AppPopover';
import { AppToggleGroup, AppToggleGroupItem } from '@/components/AppToggleGroup';
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
        <h3 className="text-[0.8125rem] font-semibold text-foreground">Automatic snapshots</h3>
        <p className="mt-1 mb-2 text-[0.7375rem] leading-[1.45] text-pretty text-ink-faint">
          {SNAPSHOTS_INTRO}
        </p>
        {SNAPSHOT_TRIGGER_OPTIONS.map(({ trigger, label, description }) => (
          <label key={trigger} className="flex cursor-pointer items-start gap-2.25 py-1.5">
            <AppCheckbox
              size="sm"
              checked={triggers[trigger]}
              onCheckedChange={(checked) => setTrigger(trigger, checked === true)}
              className="mt-0.5"
            />
            <span>
              <span className="block text-[0.7875rem] text-ink-soft">{label}</span>
              {description && (
                <span className="mt-px block text-[0.7125rem] text-ink-faint">{description}</span>
              )}
            </span>
          </label>
        ))}
        <h3 className="mt-3 text-[0.8125rem] font-semibold text-foreground">
          Fold old automatic snapshots
        </h3>
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
        <p className="mt-1.5 text-[0.7375rem] leading-[1.45] text-pretty text-ink-faint">
          {FOLD_NOTE}
        </p>
      </AppPopoverContent>
    </AppPopover>
  );
}
