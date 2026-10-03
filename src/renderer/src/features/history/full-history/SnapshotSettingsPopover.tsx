import { Settings } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useUiStore } from '@/stores/uiStore';
import {
  FOLD_NOTE,
  FOLD_OPTIONS,
  SNAPSHOT_TRIGGER_OPTIONS,
  SNAPSHOTS_INTRO,
} from '../snapshotSettings';

const SEGMENT =
  'h-5.75 min-w-0 rounded-[0.3125rem] px-2.25 text-xs font-medium text-ink-muted hover:bg-transparent hover:text-foreground aria-checked:bg-pane-raised aria-checked:text-foreground aria-checked:shadow-[0_1px_2px_oklch(0_0_0/25%)]';

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
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <AppButton
          variant="ghost"
          size="xs"
          title="When automatic snapshots happen"
          className="data-[state=open]:bg-line-strong data-[state=open]:text-foreground"
        >
          <Settings />
          Automatic snapshots
        </AppButton>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        aria-label="Automatic snapshots"
        // Escape closes the popover, not the history view behind it.
        onEscapeKeyDown={(event) => event.stopPropagation()}
        className="w-80 rounded-[0.625rem] border-line-strong bg-pane px-3.5 py-3 shadow-[0_14px_40px_-12px_rgb(0_0_0/60%)]"
      >
        <h3 className="text-[0.8125rem] font-semibold text-foreground">Automatic snapshots</h3>
        <p className="mt-1 mb-2 text-[0.7375rem] leading-[1.45] text-pretty text-ink-faint">
          {SNAPSHOTS_INTRO}
        </p>
        {SNAPSHOT_TRIGGER_OPTIONS.map(({ trigger, label, description }) => (
          <label key={trigger} className="flex cursor-pointer items-start gap-2.25 py-1.5">
            <Checkbox
              checked={triggers[trigger]}
              onCheckedChange={(checked) => setTrigger(trigger, checked === true)}
              className="mt-0.5 size-3.5"
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
        <ToggleGroup
          type="single"
          spacing={0.5}
          value={String(foldDays)}
          onValueChange={(value) =>
            value && setFoldDays(FOLD_OPTIONS.find((option) => String(option.days) === value)!.days)
          }
          aria-label="Fold old automatic snapshots"
          className="mt-1.5 rounded-md border border-line bg-line p-0.5"
        >
          {FOLD_OPTIONS.map(({ days, label }) => (
            <ToggleGroupItem key={label} value={String(days)} className={SEGMENT}>
              {label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <p className="mt-1.5 text-[0.7375rem] leading-[1.45] text-pretty text-ink-faint">
          {FOLD_NOTE}
        </p>
      </PopoverContent>
    </Popover>
  );
}
