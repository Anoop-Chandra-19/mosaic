import { useLayoutEffect, useRef, useState } from 'react';
import { AppButton } from '@/components/AppButton';
import { cn } from '@/lib/utils';
import { useOverlayStore } from '@/stores/overlayStore';
import { useUiStore } from '@/stores/uiStore';
import type { ChangeTone } from '@shared/resume/changes/resumeChange';
import type { VersionMeta } from '@shared/types/db';
import type { HistoryFilter } from '@/types/history';
import { chooseVisibleVersions } from './chooseVisibleVersions';
import {
  filterVersionHistory,
  isHistoryFiltered,
  listHistorySections,
  NO_HISTORY_FILTER,
} from '../filterVersionHistory';
import {
  findFoldCutoff,
  formatHistoryMonth,
  formatTimeInDay,
  groupVersionHistory,
  type HistoryGroup,
} from '../groupVersionHistory';
import { versionLabel } from '../useTemplateVersions';
import { HistoryFilterBar, type HistoryMonth } from './HistoryFilterBar';
import { HistoryCount, HistoryHandoff, HistoryRangeEdge } from './HistoryListEdges';
import { useVersionEdits } from './useVersionEdits';
import {
  clampVisibleRange,
  NEWEST_RANGE,
  revealInVisibleRange,
  showEarlierInVisibleRange,
  showNewerInVisibleRange,
} from './moveVisibleRange';
import { RunRow } from './RunRow';
import { VersionRow, type VersionRowActions } from './VersionRow';

/** A request to bring a version into view. A new object asks again, even for the same one. */
export interface HistoryReveal {
  versionId: string;
}

interface VersionListProps extends VersionRowActions {
  /** Newest first. */
  versions: VersionMeta[];
  /**
   * A template that is not open: its newest dozen and no filter bar, so two sticky strips
   * never share the sidebar.
   */
  isCompact?: boolean;
  /**
   * The full view's list: a range of the history that grows at either end, rows that
   * select on click, and day groups even while filtered, since there is room for them.
   */
  isWide?: boolean;
  initialFilter?: HistoryFilter;
  reveal?: HistoryReveal | null;
  /** Wide only: a click anywhere on a row selects it, as its Read button does. */
  onSelect?: (version: VersionMeta) => void;
  /** Tells the opener which filter is on, so the full view can start from it. */
  onOpenFullHistory?: (filter: HistoryFilter) => void;
  /** The fold note's "change". Without it, Settings opens on History. */
  onChangeFolding?: () => void;
  /** Shown on the row being read: what it changed from the one before it. */
  selectedCounts?: Record<ChangeTone, number> | null;
}

/** A template's history until the count line is worth its row. */
const SHORT_HISTORY = 8;
/** A list this long has scrolled far enough that its end is worth saying. */
const END_LINE_ROWS = 60;

/** The run or fold holding a version, by the key it opens under: its oldest version's id. */
function findHolderKey(groups: HistoryGroup[], versionId: string): string | null {
  for (const group of groups) {
    for (const item of group.items) {
      if (item.kind !== 'version' && item.versions.some((version) => version.id === versionId)) {
        return item.versions.at(-1)!.id;
      }
    }
  }
  return null;
}

/**
 * One history, two layers: auto versions Mosaic takes on its own (import, restore) sit
 * quiet; named versions are the user's own bookmarks — bold, with the amber mark.
 */
export function VersionList({
  versions,
  isCompact = false,
  isWide = false,
  initialFilter = NO_HISTORY_FILTER,
  reveal = null,
  onSelect,
  onOpenFullHistory,
  onChangeFolding,
  selectedCounts,
  ...rowProps
}: VersionListProps) {
  const [filter, setFilterOnly] = useState(initialFilter);
  const [isSearching, setIsSearching] = useState(initialFilter.query !== '');
  // Keyed by a run's oldest version, which stays the same as newer edits join the run.
  const [openRuns, setOpenRuns] = useState<ReadonlySet<string>>(new Set());
  const [range, setRange] = useState(NEWEST_RANGE);
  const [handledReveal, setHandledReveal] = useState<HistoryReveal | null>(null);
  const [openedForReveal, setOpenedForReveal] = useState<HistoryReveal | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const foldDays = useUiStore((s) => s.foldSnapshotsAfterDays);
  const openSettings = useOverlayStore((s) => s.openSettings);
  const edits = useVersionEdits();

  // A different filter is a different list, so the range starts again at its newest.
  const setFilter = (next: HistoryFilter) => {
    setFilterOnly(next);
    setRange(NEWEST_RANGE);
  };

  // A peek has no filter bar, so a filter left from when the template was open must not apply.
  const isFiltering = !isCompact && isHistoryFiltered(filter);
  const matched = isFiltering ? filterVersionHistory(versions, filter) : versions;

  if (reveal !== handledReveal) {
    setHandledReveal(reveal);
    if (reveal) {
      let index = matched.findIndex((version) => version.id === reveal.versionId);
      // Asked for a version the filter hides: the filter gives way, not the request.
      if (index < 0) {
        setFilterOnly(NO_HISTORY_FILTER);
        setIsSearching(false);
        index = versions.findIndex((version) => version.id === reveal.versionId);
      }
      if (index >= 0) setRange((current) => revealInVisibleRange(current, index));
    }
  }

  const clampedRange = clampVisibleRange(range, matched.length);
  const { shown, hiddenCount, mode } = isWide
    ? {
        shown: matched.slice(clampedRange.from, clampedRange.to),
        hiddenCount: matched.length - clampedRange.to,
        mode: 'range' as const,
      }
    : chooseVisibleVersions(matched, { total: versions.length, isFiltering, isCompact });
  const newerCount = isWide ? clampedRange.from : 0;
  // A match is never hidden in a fold, so a filtered list folds nothing.
  const groups = groupVersionHistory(shown, {
    byMonth: isFiltering && !isWide,
    foldBefore: isFiltering ? -Infinity : findFoldCutoff(foldDays),
  });

  // A version asked for that sits in a run or a fold opens it, so the row itself shows.
  if (reveal !== openedForReveal) {
    setOpenedForReveal(reveal);
    const holder = reveal && findHolderKey(groups, reveal.versionId);
    if (holder && !openRuns.has(holder)) setOpenRuns(new Set(openRuns).add(holder));
  }

  // Scroll once the revealed version is really in the tree. One held in a run scrolls to
  // the run.
  useLayoutEffect(() => {
    if (!reveal) return;
    const root = rootRef.current;
    const target =
      root?.querySelector(`[data-version-id="${reveal.versionId}"]`) ??
      root?.querySelector(`[data-version-ids~="${reveal.versionId}"]`);
    target?.scrollIntoView({ block: 'center' });
  }, [reveal]);
  const isLong = versions.length > SHORT_HISTORY;
  const hasFilterBar = isLong && !isCompact;

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
      isWide={isWide}
      label={versionLabel(version)}
      time={formatTimeInDay(version.createdAt)}
      mode={edits.modeOf(version)}
      counts={version.id === rowProps.previewId ? selectedCounts : null}
      isJustNamed={edits.justNamedId === version.id}
      onModeChange={(mode) => edits.setMode(version, mode)}
      onName={edits.name}
      onDelete={edits.remove}
      onSelect={onSelect}
      {...rowProps}
    />
  );
  const foldNoteIndex = groups.findIndex((group) => group.isPastFold);
  const jumpToNewest = () => {
    setRange(NEWEST_RANGE);
    // The newest rows may only now be rendering, so the scroll waits for them.
    requestAnimationFrame(() => rootRef.current?.scrollIntoView({ block: 'start' }));
  };
  return (
    <div ref={rootRef} className="@container/history">
      {isLong && (
        <HistoryCount
          versions={versions}
          isCompact={isCompact}
          onOpenFullHistory={
            onOpenFullHistory && !isWide ? () => onOpenFullHistory(NO_HISTORY_FILTER) : undefined
          }
        />
      )}
      {hasFilterBar && (
        <HistoryFilterBar
          filter={filter}
          onFilterChange={setFilter}
          sections={listHistorySections(versions)}
          total={versions.length}
          months={months}
          onJumpToNewest={jumpToNewest}
          onJumpToMonth={jumpToMonth}
          isSearching={isSearching}
          onSearchingChange={setIsSearching}
        />
      )}
      {newerCount > 0 && (
        <HistoryRangeEdge
          direction="newer"
          count={newerCount}
          onShow={() => setRange(showNewerInVisibleRange)}
        />
      )}
      <div className="relative mt-1.5">
        {groups.length > 0 && (
          <span
            aria-hidden
            className="absolute top-2 bottom-2.5 left-[0.34rem] w-px bg-zinc-300 dark:bg-zinc-700"
          />
        )}
        {groups.map((group, index) => (
          <section
            key={`${group.isPastFold ? 'month' : 'day'}-${group.key}`}
            data-group={group.key}
            aria-label={group.label}
            className={scrollMargin}
          >
            {index === foldNoteIndex && (
              <p
                role="note"
                className="mt-4 ml-5.5 flex flex-wrap items-baseline gap-x-2 border-t border-dashed border-line-strong pt-1.75 text-[0.725rem] leading-[1.4] text-pretty text-ink-muted"
              >
                <span>
                  Older than {foldDays} days: automatic snapshots fold by month. Nothing is deleted.
                </span>
                <AppButton
                  variant="link"
                  shape="text"
                  onClick={onChangeFolding ?? (() => openSettings('history'))}
                  className="h-auto p-0 font-mono text-[0.7rem] text-ink-muted underline underline-offset-2 hover:text-amber-600 dark:hover:text-amber-400"
                >
                  change
                </AppButton>
              </p>
            )}
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
                    kind={item.kind}
                    run={item.versions}
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
      {hiddenCount > 0 && isWide ? (
        <HistoryRangeEdge
          direction="earlier"
          count={hiddenCount}
          oldestMonth={formatHistoryMonth(matched.at(-1)!.createdAt)}
          onShow={() => setRange(showEarlierInVisibleRange)}
        />
      ) : hiddenCount > 0 && onOpenFullHistory ? (
        <HistoryHandoff
          label={
            mode === 'found'
              ? `See all ${matched.length.toLocaleString()} matches`
              : 'Open the full history'
          }
          hiddenCount={hiddenCount}
          oldestMonth={formatHistoryMonth(matched.at(-1)!.createdAt)}
          isCompact={isCompact}
          // The view opens on the matches the sidebar was showing.
          onOpenFullHistory={() => onOpenFullHistory(isFiltering ? filter : NO_HISTORY_FILTER)}
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
