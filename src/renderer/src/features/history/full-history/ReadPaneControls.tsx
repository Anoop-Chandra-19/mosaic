import { Check, ChevronDown, Eye, Minus, Plus } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { AppTooltip } from '@/components/AppTooltip';
import { AppMenu, AppMenuContent, AppMenuItem, AppMenuTrigger } from '@/components/AppMenu';
import { AppToggleGroup, AppToggleGroupItem } from '@/components/AppToggleGroup';
import { cn } from '@/lib/utils';
import { PREVIEW_ZOOM_RANGE } from '@/stores/uiStore';
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
  isMarked: boolean;
  onMarkedChange: (isMarked: boolean) => void;
  /** The page was chosen over the text read in a narrow pane, which can be gone back to. */
  canReadAsText: boolean;
  onReadAsText: () => void;
  /** The page's zoom, while the page is the view; null otherwise. */
  zoom: ReadPaneZoom | null;
}

interface ReadPaneZoom {
  value: number;
  /** The pane reads the version as text: zooming in shows the page instead. */
  isTextRead: boolean;
  onStep: (direction: 1 | -1) => void;
  onReset: () => void;
}

function ZoomControl({ value, isTextRead, onStep, onReset }: ReadPaneZoom) {
  return (
    <span className="inline-flex items-center gap-0.5">
      <AppButton
        variant="ghost"
        size="2xs"
        shape="square"
        aria-label="Zoom out"
        disabled={isTextRead || value <= PREVIEW_ZOOM_RANGE.min}
        onClick={() => onStep(-1)}
      >
        <Minus />
      </AppButton>
      <AppButton
        variant="ghost"
        size="2xs"
        className="min-w-8.5 px-1 font-mono text-[0.6875rem] font-normal text-ink-soft"
        aria-label="Reset zoom"
        title={isTextRead ? 'Zoom in to read the printed page' : 'Reset to fit width'}
        disabled={isTextRead}
        onClick={onReset}
      >
        {isTextRead ? 'Text' : `${Math.round(value * 100)}%`}
      </AppButton>
      <AppButton
        variant="ghost"
        size="2xs"
        shape="square"
        aria-label="Zoom in"
        disabled={value >= PREVIEW_ZOOM_RANGE.max}
        onClick={() => onStep(1)}
      >
        <Plus />
      </AppButton>
    </span>
  );
}

/** What the version is read against, and how. */
export function ReadPaneControls({
  versionLabel,
  isAgainstDraft,
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
        type="single"
        size="sm"
        value={isAgainstDraft ? 'draft' : 'parent'}
        onValueChange={(value) => value && onComparisonChange(value as HistoryComparison)}
        aria-label="Compare with"
        className="p-0.5"
      >
        <AppTooltip
          content={
            canCompareWithParent
              ? 'Only what this version did, against the one before it'
              : 'The first version has nothing before it'
          }
        >
          <AppToggleGroupItem value="parent" disabled={!canCompareWithParent}>
            Changes in {versionLabel}
          </AppToggleGroupItem>
        </AppTooltip>
        <AppTooltip content="What Restore would do">
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
              <span className="text-[0.78125rem] text-foreground">{label}</span>
              <span className="text-[0.71875rem] text-ink-faint">{description}</span>
            </AppMenuItem>
          ))}
        </AppMenuContent>
      </AppMenu>
      {zoom && <ZoomControl {...zoom} />}
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
          aria-label={
            isMarked ? 'Hide the marks, read the clean page' : 'Mark the changes on the page'
          }
          onClick={() => onMarkedChange(!isMarked)}
          className={cn(isMarked && 'bg-line-strong text-foreground')}
        >
          <Eye />
        </AppButton>
      )}
    </div>
  );
}
