import { Check, ChevronDown, Eye } from 'lucide-react';
import {
  AppButton,
  AppTooltip,
  AppMenu,
  AppMenuContent,
  AppMenuItem,
  AppMenuTrigger,
  AppToggleGroup,
  AppToggleGroupItem,
  Text,
} from '@/components/ui-kit';
import { tourTargetProps } from '@/features/onboarding/tourTargets';
import { PageZoomControl, type PageZoomControlProps } from '@/features/preview/PageZoomControl';
import { cn } from '@/lib/utils';
import type { HistoryComparison, ReadPaneView } from '@/types/history';

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
  /** "v11" for a revision of a number, which can be read as all the number did. */
  numberLabel: string | null;
  comparedWith: HistoryComparison;
  canCompareWithParent: boolean;
  onComparisonChange: (comparison: HistoryComparison) => void;
  view: ReadPaneView;
  onViewChange: (view: ReadPaneView) => void;
  isMarked: boolean;
  onMarkedChange: (isMarked: boolean) => void;
  /** The page was chosen over the text read in a narrow pane, which can be gone back to. */
  canReadAsText: boolean;
  onReadAsText: () => void;
  /** The page's zoom, while the page is the view; null otherwise. */
  zoom: PageZoomControlProps | null;
}

/** What the version is read against, and how. */
export function ReadPaneControls({
  versionLabel,
  numberLabel,
  comparedWith,
  canCompareWithParent,
  onComparisonChange,
  view,
  onViewChange,
  isMarked,
  onMarkedChange,
  canReadAsText,
  onReadAsText,
  zoom,
}: ReadPaneControlsProps) {
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
      <AppToggleGroup
        {...tourTargetProps('historyCompare')}
        type="single"
        size="sm"
        value={comparedWith}
        onValueChange={(value) => value && onComparisonChange(value as HistoryComparison)}
        aria-label="Compare with"
        className="p-0.5"
      >
        <AppTooltip
          content={
            canCompareWithParent
              ? 'What changed in this version since the one before'
              : 'The first version has nothing before it'
          }
        >
          <AppToggleGroupItem value="parent" disabled={!canCompareWithParent}>
            Changes in {versionLabel}
          </AppToggleGroupItem>
        </AppTooltip>
        {numberLabel && (
          <AppTooltip content={`All changes in ${numberLabel}, across its revisions`}>
            <AppToggleGroupItem value="number">All of {numberLabel}</AppToggleGroupItem>
          </AppTooltip>
        )}
        <AppTooltip content="What restoring this version would change">
          <AppToggleGroupItem value="draft">Against your draft</AppToggleGroupItem>
        </AppTooltip>
      </AppToggleGroup>
      <span className="flex-1" />
      <AppMenu>
        <AppMenuTrigger asChild>
          <AppButton variant="ghost" size="2xs">
            View as: {view === 'page' ? 'Page' : 'Changes only'}
            <ChevronDown className="size-2.75" />
          </AppButton>
        </AppMenuTrigger>
        <AppMenuContent align="end" className="w-65">
          {VIEWS.map(({ value, label, description }) => (
            <AppMenuItem
              key={value}
              role="menuitemradio"
              aria-checked={view === value}
              onSelect={() => onViewChange(value)}
              className="relative flex-col items-start gap-px py-1.75 pl-7"
            >
              {view === value && (
                <Check aria-hidden className="absolute top-2.25 left-2.25 size-3 text-ink-soft" />
              )}
              <Text variant="secondary" className="text-foreground">
                {label}
              </Text>
              <Text variant="secondary" className="text-ink-faint">
                {description}
              </Text>
            </AppMenuItem>
          ))}
        </AppMenuContent>
      </AppMenu>
      {zoom && <PageZoomControl {...zoom} />}
      {canReadAsText && (
        <AppButton
          variant="ghost"
          size="2xs"
          title="Read this version as text"
          onClick={onReadAsText}
        >
          Text
        </AppButton>
      )}
      {view === 'page' && (
        <AppButton
          variant="ghost"
          size="2xs"
          shape="square"
          aria-pressed={isMarked}
          aria-label={isMarked ? 'Hide the change marks' : 'Show the change marks'}
          onClick={() => onMarkedChange(!isMarked)}
          className={cn(isMarked && 'bg-line-strong text-foreground')}
        >
          <Eye />
        </AppButton>
      )}
    </div>
  );
}
