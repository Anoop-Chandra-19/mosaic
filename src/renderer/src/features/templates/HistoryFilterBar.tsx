import { useRef } from 'react';
import { ChevronUp, Clock, LayoutTemplate, List, Save, Search, Sparkles, X } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { AppTooltip } from '@/components/AppTooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import type { HistoryFilter, HistoryKindFilter } from './filterVersionHistory';

const KIND_FILTERS: {
  value: HistoryKindFilter;
  label: string;
  hint: string;
  Icon: typeof List;
}[] = [
  { value: 'all', label: 'All', hint: 'Everything', Icon: List },
  { value: 'named', label: 'Named', hint: 'Only the versions you named', Icon: Save },
  {
    value: 'events',
    label: 'Events',
    hint: 'Named versions, imports, restores, and where you left off',
    Icon: Sparkles,
  },
];

/** A month the rendered list reaches, keyed by its newest day group. */
export interface HistoryMonth {
  label: string;
  key: number;
}

interface HistoryFilterBarProps {
  filter: HistoryFilter;
  onFilterChange: (filter: HistoryFilter) => void;
  sections: string[];
  total: number;
  months: HistoryMonth[];
  onJumpToNewest: () => void;
  onJumpToMonth: (key: number) => void;
  isSearching: boolean;
  onSearchingChange: (isSearching: boolean) => void;
}

/** The history's sticky strip: which versions, which section, Jump, and search. */
export function HistoryFilterBar({
  filter,
  onFilterChange,
  sections,
  total,
  months,
  onJumpToNewest,
  onJumpToMonth,
  isSearching,
  onSearchingChange,
}: HistoryFilterBarProps) {
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const setSection = (section: string | null) => onFilterChange({ ...filter, section });
  const toggleSearch = () => {
    onFilterChange({ ...filter, query: '' });
    onSearchingChange(!isSearching);
  };

  return (
    <>
      <div className="sticky top-0 z-5 mt-0.5 flex h-10.5 items-center gap-1.25 border-b border-line bg-white dark:bg-zinc-950">
        <ToggleGroup
          type="single"
          spacing={0.5}
          value={filter.kind}
          onValueChange={(kind) =>
            kind && onFilterChange({ ...filter, kind: kind as HistoryKindFilter })
          }
          aria-label="Which versions to show"
          className="rounded-md border border-line bg-line p-0.5"
        >
          {/* Styled by aria-checked: the tooltip's trigger overwrites the item's data-state. */}
          {KIND_FILTERS.map(({ value, label, hint, Icon }) => (
            <AppTooltip key={value} content={hint}>
              <ToggleGroupItem
                value={value}
                aria-label={label}
                className="h-5.5 min-w-0 gap-1.25 rounded-[0.3125rem] px-2.25 text-xs font-medium text-ink-muted hover:bg-transparent hover:text-foreground aria-checked:bg-pane-raised aria-checked:text-foreground aria-checked:shadow-[0_1px_2px_oklch(0_0_0/25%)] @max-[22.5rem]/history:px-1.75"
              >
                <Icon className="size-2.75" />
                <span className="@max-[22.5rem]/history:hidden">{label}</span>
              </ToggleGroupItem>
            </AppTooltip>
          ))}
        </ToggleGroup>
        {filter.section !== null && (
          <AppButton
            variant="ghost"
            size="2xs"
            title="Clear the section filter"
            aria-label={`Clear the section filter, ${filter.section}`}
            onClick={() => setSection(null)}
            className="h-5.5 min-w-0 gap-1.25 rounded-md border border-line bg-line px-2 text-xs text-ink-soft"
          >
            <span className="truncate">{filter.section}</span>
            <X className="size-2.5" />
          </AppButton>
        )}
        <span className="flex-1" />
        {sections.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <AppButton
                variant="ghost"
                size="xs"
                shape="square"
                aria-label="Only versions that touched one section"
                className={cn(filter.section !== null && 'bg-line-strong text-foreground')}
              >
                <LayoutTemplate className="size-3" />
              </AppButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuRadioGroup
                value={filter.section ?? ''}
                onValueChange={(section) => setSection(section || null)}
              >
                <DropdownMenuRadioItem value="">Any section</DropdownMenuRadioItem>
                <DropdownMenuSeparator />
                {sections.map((section) => (
                  <DropdownMenuRadioItem key={section} value={section}>
                    {section}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {months.length > 1 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <AppButton
                variant="ghost"
                size="xs"
                title="Jump to a month"
                className="@max-[22.5rem]/history:px-1.5"
              >
                <Clock />
                <span className="@max-[22.5rem]/history:sr-only">Jump</span>
              </AppButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-46">
              <DropdownMenuItem onClick={onJumpToNewest}>
                <ChevronUp />
                Newest version
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {months.slice(0, 12).map((month) => (
                <DropdownMenuItem key={month.key} onClick={() => onJumpToMonth(month.key)}>
                  <Clock />
                  {month.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <AppButton
          ref={searchButtonRef}
          variant="ghost"
          size="xs"
          shape="square"
          aria-label="Find a version by name"
          aria-pressed={isSearching}
          onClick={toggleSearch}
          className={cn(isSearching && 'bg-line-strong text-foreground')}
        >
          <Search className="size-3" />
        </AppButton>
      </div>
      {isSearching && (
        <div className="sticky top-10.5 z-5 flex h-10 items-center border-b border-line bg-white dark:bg-zinc-950">
          <span className="relative flex-1">
            <Search
              aria-hidden
              className="absolute top-1/2 left-1.75 size-3.25 -translate-y-1/2 text-ink-faint"
            />
            <Input
              autoFocus
              aria-label="Find a version"
              placeholder={`Find a version in all ${total.toLocaleString()}…`}
              value={filter.query}
              onChange={(event) => onFilterChange({ ...filter, query: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  // Closing the search is the smallest thing Escape can undo here.
                  event.preventDefault();
                  event.stopPropagation();
                  toggleSearch();
                  searchButtonRef.current?.focus();
                }
              }}
              className="h-7 pl-6.5 text-[0.78125rem] md:text-[0.78125rem]"
            />
          </span>
        </div>
      )}
    </>
  );
}
