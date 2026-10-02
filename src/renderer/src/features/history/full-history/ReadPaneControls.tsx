import { Check, ChevronDown } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { AppTooltip } from '@/components/AppTooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { HistoryComparison } from '@/types/history';

export type ReadPaneView = 'page' | 'changes';

const VIEWS: { value: ReadPaneView; label: string; description: string }[] = [
  { value: 'page', label: 'Page', description: 'The version as it prints, changes marked' },
  {
    value: 'changes',
    label: 'Changes only',
    description: 'Just the lines that differ, before and after',
  },
];

interface ReadPaneControlsProps {
  versionLabel: string;
  isAgainstDraft: boolean;
  canCompareWithParent: boolean;
  onComparisonChange: (comparison: HistoryComparison) => void;
  view: ReadPaneView;
  onViewChange: (view: ReadPaneView) => void;
}

/** What the version is read against, and how. */
export function ReadPaneControls({
  versionLabel,
  isAgainstDraft,
  canCompareWithParent,
  onComparisonChange,
  view,
  onViewChange,
}: ReadPaneControlsProps) {
  const item =
    'h-5.75 min-w-0 rounded-[0.3125rem] px-2.25 text-xs font-medium text-ink-muted hover:bg-transparent hover:text-foreground disabled:text-ink-faint aria-checked:bg-pane-raised aria-checked:text-foreground aria-checked:shadow-[0_1px_2px_oklch(0_0_0/25%)]';
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
      <ToggleGroup
        type="single"
        spacing={0.5}
        value={isAgainstDraft ? 'draft' : 'parent'}
        onValueChange={(value) => value && onComparisonChange(value as HistoryComparison)}
        aria-label="Compare with"
        className="rounded-md border border-line bg-line p-0.5"
      >
        {/* Styled by aria-checked: the tooltip's trigger overwrites the item's data-state. */}
        <AppTooltip
          content={
            canCompareWithParent
              ? 'Only what this version did, against the one before it'
              : 'The first version has nothing before it'
          }
        >
          <ToggleGroupItem value="parent" disabled={!canCompareWithParent} className={item}>
            Changes in {versionLabel}
          </ToggleGroupItem>
        </AppTooltip>
        <AppTooltip content="What Restore would do">
          <ToggleGroupItem value="draft" className={item}>
            Against your draft
          </ToggleGroupItem>
        </AppTooltip>
      </ToggleGroup>
      <span className="flex-1" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <AppButton variant="ghost" size="2xs">
            View as: {view === 'page' ? 'Page' : 'Changes only'}
            <ChevronDown className="size-2.75" />
          </AppButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-65">
          {VIEWS.map(({ value, label, description }) => (
            <DropdownMenuItem
              key={value}
              role="menuitemradio"
              aria-checked={view === value}
              onSelect={() => onViewChange(value)}
              className="relative flex-col items-start gap-px py-1.75 pl-7"
            >
              {view === value && (
                <Check aria-hidden className="absolute top-2.25 left-2.25 size-3 text-ink-soft" />
              )}
              <span className="text-[0.78125rem] text-foreground">{label}</span>
              <span className="text-[0.71875rem] text-ink-faint">{description}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
