import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { VersionMeta } from '@shared/types/db';
import { chooseVisibleVersions } from './chooseVisibleVersions';
import {
  filterVersionHistory,
  isHistoryFiltered,
  listHistorySections,
  NO_HISTORY_FILTER,
} from './filterVersionHistory';
import { formatHistoryMonth, formatTimeInDay, groupVersionHistory } from './groupVersionHistory';
import { HistoryFilterBar, type HistoryMonth } from './HistoryFilterBar';
import { HistoryCount, HistoryHandoff } from './HistoryListEdges';
import { RunRow } from './RunRow';
import { versionLabel } from './useTemplateVersions';
import { VersionRow, type VersionRowActions } from './VersionRow';

interface VersionListProps extends VersionRowActions {
  /** Newest first. */
  versions: VersionMeta[];
  /**
   * A template that is not open: its newest dozen and no filter bar, so two sticky strips
   * never share the sidebar.
   */
  isCompact?: boolean;
  /** Until the full history view exists, the versions past the sidebar's are only counted. */
  onOpenFullHistory?: () => void;
}

/** A template's history until the count line is worth its row. */
const SHORT_HISTORY = 8;
/** A list this long has scrolled far enough that its end is worth saying. */
const END_LINE_ROWS = 60;

/**
 * One history, two layers: auto versions Mosaic takes on its own (import, restore) sit
 * quiet; named versions are the user's own bookmarks — bold, with the amber mark.
 */
export function VersionList({
  versions,
  isCompact = false,
  onOpenFullHistory,
  ...rowProps
}: VersionListProps) {
  const [filter, setFilter] = useState(NO_HISTORY_FILTER);
  const [isSearching, setIsSearching] = useState(false);
  // Keyed by a run's oldest version, which stays the same as newer edits join the run.
  const [openRuns, setOpenRuns] = useState<ReadonlySet<string>>(new Set());
  const rootRef = useRef<HTMLDivElement>(null);

  // A peek has no filter bar, so a filter left from when the template was open must not apply.
  const isFiltering = !isCompact && isHistoryFiltered(filter);
  const matched = isFiltering ? filterVersionHistory(versions, filter) : versions;
  const { shown, hiddenCount, mode } = chooseVisibleVersions(matched, {
    total: versions.length,
    isFiltering,
    isCompact,
  });
  const groups = groupVersionHistory(shown, { byMonth: isFiltering });
  const isLong = versions.length > SHORT_HISTORY;
  const hasFilterBar = isLong && !isCompact;
  const positions = new Map(versions.map((version, index) => [version.id, index]));
  const labelOf = (version: VersionMeta) => versionLabel(versions, positions.get(version.id)!);

  const months: HistoryMonth[] = [];
  for (const group of groups) {
    const label = formatHistoryMonth(group.key);
    if (months.at(-1)?.label !== label) months.push({ label, key: group.key });
  }
  // The strip is sticky, so a scrolled-to heading stops below it rather than under it.
  const scrollMargin = isSearching ? 'scroll-mt-[5.125rem]' : 'scroll-mt-10.5';
  const jumpToMonth = (key: number) =>
    rootRef.current?.querySelector(`[data-group="${key}"]`)?.scrollIntoView({ block: 'start' });

  const toggleRun = (key: string) =>
    setOpenRuns((open) => {
      const next = new Set(open);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  const renderRow = (version: VersionMeta, isNested = false) => (
    <VersionRow
      key={version.id}
      version={version}
      isHead={version.id === versions[0].id}
      isNested={isNested}
      label={labelOf(version)}
      time={formatTimeInDay(version.createdAt)}
      {...rowProps}
    />
  );
  return (
    <div ref={rootRef} className="@container/history">
      {isLong && (
        <HistoryCount
          versions={versions}
          isCompact={isCompact}
          onOpenFullHistory={onOpenFullHistory}
        />
      )}
      {hasFilterBar && (
        <HistoryFilterBar
          filter={filter}
          onFilterChange={setFilter}
          sections={listHistorySections(versions)}
          total={versions.length}
          months={months}
          onJumpToNewest={() => rootRef.current?.scrollIntoView({ block: 'start' })}
          onJumpToMonth={jumpToMonth}
          isSearching={isSearching}
          onSearchingChange={setIsSearching}
        />
      )}
      <div className="relative mt-1.5">
        {groups.length > 0 && (
          <span
            aria-hidden
            className="absolute top-2 bottom-2.5 left-[0.34rem] w-px bg-zinc-300 dark:bg-zinc-700"
          />
        )}
        {groups.map((group) => (
          <section
            key={group.key}
            data-group={group.key}
            aria-label={group.label}
            className={scrollMargin}
          >
            <h4
              className={cn(
                'sticky z-3 flex items-center gap-2 bg-white pt-2.75 pb-1.25 pl-5.5 text-[0.65625rem] font-semibold tracking-[0.08em] uppercase dark:bg-zinc-950',
                !hasFilterBar ? 'top-0' : isSearching ? 'top-[5.125rem]' : 'top-10.5',
                group.isToday ? 'text-ink-soft' : 'text-ink-muted'
              )}
            >
              {group.label}
              <span className="font-mono font-normal tracking-normal text-ink-faint normal-case">
                {group.count}
              </span>
              <i aria-hidden className="h-px min-w-2 flex-1 bg-line" />
            </h4>
            <ol>
              {group.items.map((item) => {
                if (item.kind === 'version') return renderRow(item.version);
                const key = item.versions.at(-1)!.id;
                return (
                  <RunRow
                    key={key}
                    run={item.versions}
                    labelOf={labelOf}
                    isOpen={openRuns.has(key)}
                    onToggle={() => toggleRun(key)}
                  >
                    {item.versions.map((version) => renderRow(version, true))}
                  </RunRow>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
      {groups.length === 0 && (
        <p className="mt-3.5 mb-1.5 ml-5.5 text-[0.775rem] leading-normal text-ink-muted">
          Nothing matches {filter.query.trim() ? `“${filter.query.trim()}”` : 'that filter'}.
          Everything is still here. Clear the filter to see it.
        </p>
      )}
      {hiddenCount > 0 ? (
        <HistoryHandoff
          label={
            mode === 'found'
              ? `See all ${matched.length.toLocaleString()} matches`
              : 'Open the full history'
          }
          hiddenCount={hiddenCount}
          oldestMonth={formatHistoryMonth(matched.at(-1)!.createdAt)}
          isCompact={isCompact}
          onOpenFullHistory={onOpenFullHistory}
        />
      ) : (
        shown.length > END_LINE_ROWS && (
          <p className="mt-2.5 mb-0.5 ml-5.5 font-mono text-[0.675rem] text-ink-faint">
            That is all {shown.length.toLocaleString()} of them, back to{' '}
            {formatHistoryMonth(shown.at(-1)!.createdAt)}.
          </p>
        )
      )}
    </div>
  );
}
