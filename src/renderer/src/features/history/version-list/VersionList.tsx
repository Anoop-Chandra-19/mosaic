import { Fragment, useLayoutEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { AppButton, Text } from '@/components/ui-kit';
import { startHistoryTour } from '@/features/onboarding/history/startHistoryTour';
import { usePresenceMotion } from '@/lib/motion/usePresenceMotion';
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
import { HistoryTip } from '../learning/HistoryTip';
import { historyItemKey, useHistoryTip } from '../learning/useHistoryTip';
import { versionLabel } from '../versionLabel';
import { HistoryFilterBar, type HistoryMonth } from './HistoryFilterBar';
import { HISTORY_LINK, HistoryCount, HistoryHandoff, HistoryRangeEdge } from './HistoryListEdges';
import { useVersionEdits } from './useVersionEdits';
import {
  clampVisibleRange,
  NEWEST_RANGE,
  revealInVisibleRange,
  showEarlierInVisibleRange,
  showNewerInVisibleRange,
} from './moveVisibleRange';
import { FoldRow } from './FoldRow';
import { NumberRow, type NumberRowPlace } from './NumberRow';
import { VersionRow, type VersionRowActions } from './VersionRow';

/** A request to bring a version into view. A new object asks again, even for the same one. */
export interface HistoryReveal {
  versionId: string;
  /** A step from the row beside it: scrolled only as far as keeps it in view, not centered. */
  isNearby?: boolean;
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
  /** The history tour's example: rows read, nothing on them changes, no tips. */
  isReadOnly?: boolean;
}

/** A template's history until the count line is worth its row. */
const SHORT_HISTORY = 8;
/** Under this many versions there is little to explain: a line under the list, not tips. */
const JUST_STARTED_HISTORY = 4;
/** A list this long has scrolled far enough that its end is worth saying. */
const END_LINE_ROWS = 60;

/**
 * What opens under a key: a number's earlier revisions under its first revision's id, which
 * stays the same as revisions join it; a fold under its oldest number's.
 */
const numberKey = (revisions: VersionMeta[]) => revisions.at(-1)!.id;
const foldKey = (numbers: VersionMeta[][]) => numberKey(numbers.at(-1)!);

/** The keys to open so a version's row shows: its fold, and its number when it is an earlier revision. */
function findHolderKeys(groups: HistoryGroup[], versionId: string): string[] {
  const isEarlierIn = (revisions: VersionMeta[]) =>
    revisions.slice(1).some((version) => version.id === versionId);
  for (const group of groups) {
    for (const item of group.items) {
      const numbers = item.kind === 'fold' ? item.numbers : [item.revisions];
      const holder = numbers.find((revisions) => revisions.some((v) => v.id === versionId));
      if (!holder) continue;
      return [
        ...(item.kind === 'fold' ? [foldKey(item.numbers)] : []),
        ...(isEarlierIn(holder) ? [numberKey(holder)] : []),
      ];
    }
  }
  return [];
}

/** Under a history just started, in place of tips: what will collect here, and the tour. */
function JustStartedNote() {
  return (
    <div className="mx-0.5 mt-3 flex flex-col items-start gap-2 rounded-[0.5625rem] border border-dashed border-line-strong p-3">
      <Text as="p" variant="secondary" className="text-pretty">
        Versions collect here as you work: the ones you name, and snapshots Mosaic keeps on its own.
        Your draft is saved as you type either way.
      </Text>
      <AppButton variant="ghost" size="xs" onClick={startHistoryTour} className="-ml-1.5">
        <ChevronRight />
        How history works
      </AppButton>
    </div>
  );
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
  isReadOnly = false,
  ...rowProps
}: VersionListProps) {
  const [filter, setFilterOnly] = useState(initialFilter);
  const [isSearching, setIsSearching] = useState(initialFilter.query !== '');
  const [openHolders, setOpenHolders] = useState<ReadonlySet<string>>(new Set());
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

  const isJustStarted = versions.length < JUST_STARTED_HISTORY;
  const tip = useHistoryTip({
    listRef: rootRef,
    items: groups.flatMap((group) => group.items),
    isEnabled: !isCompact && !isReadOnly && !isJustStarted,
    isBusy: edits.isEditing,
  });
  const shownTip = usePresenceMotion(tip.chosen, tip.chosen && historyItemKey(tip.chosen.item));
  const tipKey = shownTip.shown && historyItemKey(shownTip.shown.item);
  const renderTip = () => {
    const chosen = shownTip.shown;
    if (!chosen) return null;
    return (
      <HistoryTip
        key="history-tip"
        title={chosen.tip.title}
        body={chosen.tip.body(chosen.item, { foldDays })}
        tourLabel={isWide ? 'How history works' : 'How it works'}
        isInline={!isWide}
        // Within this list: the sidebar's copy of the row stays in the tree behind the view.
        rowSelector={`[data-full-history-list] [data-version-id="${tipKey}"], [data-full-history-list] [data-version-ids~="${tipKey}"]`}
        isLeaving={shownTip.isLeaving}
        tipRef={shownTip.ref}
        onGot={tip.got}
        onTour={startHistoryTour}
      />
    );
  };

  // A version asked for that sits in a fold or among a number's earlier revisions opens
  // them, so the row itself shows.
  if (reveal !== openedForReveal) {
    setOpenedForReveal(reveal);
    const holders = reveal ? findHolderKeys(groups, reveal.versionId) : [];
    if (holders.some((key) => !openHolders.has(key))) {
      setOpenHolders(new Set([...openHolders, ...holders]));
    }
  }

  // Scroll once the revealed version is really in the tree. One held in a fold scrolls to
  // the fold. Rows keep clear of the sticky headings by their scroll margin.
  useLayoutEffect(() => {
    if (!reveal) return;
    const root = rootRef.current;
    const target =
      root?.querySelector(`[data-version-id="${reveal.versionId}"]`) ??
      root?.querySelector(`[data-version-ids~="${reveal.versionId}"]`);
    target?.scrollIntoView({ block: reveal.isNearby ? 'nearest' : 'center' });
  }, [reveal]);
  const isLong = versions.length > SHORT_HISTORY;
  const hasFilterBar = isLong && !isCompact;

  const months: HistoryMonth[] = [];
  for (const group of groups) {
    const label = formatHistoryMonth(group.key);
    if (months.at(-1)?.label !== label) months.push({ label, key: group.key });
  }
  // The strip is sticky, so a scrolled-to heading stops below it rather than under it, and
  // a row below the heading too (2rem).
  const scrollMargin = isSearching ? 'scroll-mt-[5.125rem]' : 'scroll-mt-10.5';
  const rowScrollMargin = !hasFilterBar
    ? '[&_li]:scroll-mt-8'
    : isSearching
      ? '[&_li]:scroll-mt-[7.125rem]'
      : '[&_li]:scroll-mt-[4.625rem]';
  const jumpToMonth = (key: number) =>
    rootRef.current?.querySelector(`[data-group="${key}"]`)?.scrollIntoView({ block: 'start' });

  const toggleHolder = (key: string) =>
    setOpenHolders((open) => {
      const next = new Set(open);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  const renderRow = (version: VersionMeta, isNested: boolean, place?: NumberRowPlace) => (
    <VersionRow
      key={version.id}
      version={version}
      isHead={version.id === versions[0].id}
      isNested={isNested}
      {...place}
      isWide={isWide}
      label={versionLabel(version)}
      time={formatTimeInDay(version.createdAt)}
      mode={edits.modeOf(version)}
      counts={version.id === rowProps.previewId ? selectedCounts : null}
      isJustNamed={edits.justNamedId === version.id}
      isReadOnly={isReadOnly}
      onModeChange={(mode) => {
        if (mode === 'name') tip.noteActedOn(version.id);
        edits.setMode(version, mode);
      }}
      onName={edits.name}
      onDelete={edits.remove}
      onSelect={
        onSelect &&
        ((selected) => {
          tip.noteActedOn(selected.id);
          onSelect(selected);
        })
      }
      {...rowProps}
      onPreview={(previewed, label) => {
        tip.noteActedOn(previewed.id);
        rowProps.onPreview(previewed, label);
      }}
    />
  );
  // A number with one revision is a plain row. One with more opens on its own, as well as
  // by its toggle, while one of its earlier revisions is being read.
  const renderNumber = (revisions: VersionMeta[], isNested: boolean) => {
    if (revisions.length === 1) return renderRow(revisions[0], isNested);
    const key = numberKey(revisions);
    const isReadingEarlier = revisions.slice(1).some((v) => v.id === rowProps.previewId);
    return (
      <NumberRow
        key={key}
        revisions={revisions}
        isNested={isNested}
        isOpen={openHolders.has(key) || isReadingEarlier}
        onToggle={() => {
          tip.noteActedOn(revisions[0].id);
          toggleHolder(key);
        }}
        renderRow={(version, place) => renderRow(version, isNested, place)}
      />
    );
  };
  const foldNoteIndex = groups.findIndex((group) => group.isPastFold);
  const jumpToNewest = () => {
    setRange(NEWEST_RANGE);
    // The newest rows may only now be rendering, so the scroll waits for them.
    requestAnimationFrame(() => rootRef.current?.scrollIntoView({ block: 'start' }));
  };
  return (
    <div ref={rootRef} data-full-history-list={isWide || undefined} className="@container/history">
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
          <span aria-hidden className="absolute top-2.5 bottom-3 left-1.25 w-px bg-line-strong" />
        )}
        {groups.map((group, index) => (
          <section
            key={`${group.isPastFold ? 'month' : 'day'}-${group.key}`}
            data-group={group.key}
            aria-label={group.label}
            className={scrollMargin}
          >
            {index === foldNoteIndex && (
              <Text
                as="p"
                variant="secondary"
                role="note"
                className="mt-4 ml-5.5 flex flex-wrap items-baseline gap-x-2 border-t border-dashed border-line-strong pt-1.75 text-pretty"
              >
                <span>
                  Older than {foldDays} days: automatic snapshots fold by month. Nothing is deleted.
                </span>
                <AppButton
                  variant="link"
                  shape="text"
                  onClick={onChangeFolding ?? (() => openSettings('history'))}
                  className={HISTORY_LINK}
                >
                  change
                </AppButton>
              </Text>
            )}
            <Text
              as="h4"
              variant="eyebrow"
              className={cn(
                'sticky z-3 flex items-center gap-2 bg-background pt-2.75 pb-1.25 pl-5.5',
                !hasFilterBar ? 'top-0' : isSearching ? 'top-20.5' : 'top-10.5',
                group.isToday ? 'text-ink-soft' : 'text-ink-muted'
              )}
            >
              {group.label}
              <Text variant="meta" className="normal-case">
                {group.count}
              </Text>
              <i aria-hidden className="h-px min-w-2 flex-1 bg-line" />
            </Text>
            <ol className={rowScrollMargin}>
              {group.items.map((item) => {
                // In the sidebar a tip sits under its row, in the list; in the full view it floats.
                const itemTip = !isWide && historyItemKey(item) === tipKey && renderTip();
                if (item.kind === 'number') {
                  return (
                    // Keyed as NumberRow is, by its first revision: a new one keeps the row.
                    <Fragment key={numberKey(item.revisions)}>
                      {renderNumber(item.revisions, false)}
                      {itemTip}
                    </Fragment>
                  );
                }
                const key = foldKey(item.numbers);
                return (
                  <Fragment key={key}>
                    <FoldRow
                      numbers={item.numbers.map((revisions) => revisions[0])}
                      isOpen={openHolders.has(key)}
                      onToggle={() => {
                        tip.noteActedOn(historyItemKey(item));
                        toggleHolder(key);
                      }}
                    >
                      {item.numbers.map((revisions) => renderNumber(revisions, true))}
                    </FoldRow>
                    {itemTip}
                  </Fragment>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
      {isWide && renderTip()}
      {isJustStarted && !isCompact && !isReadOnly && <JustStartedNote />}
      {groups.length === 0 && (
        <Text as="p" variant="secondary" className="mt-3.5 mb-1.5 ml-5.5">
          Nothing matches {filter.query.trim() ? `“${filter.query.trim()}”` : 'that filter'}.
          Everything is still here. Clear the filter to see it.
        </Text>
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
          <Text as="p" variant="meta" className="mt-2.5 mb-0.5 ml-5.5">
            That is all {shown.length.toLocaleString()} of them, back to{' '}
            {formatHistoryMonth(shown.at(-1)!.createdAt)}.
          </Text>
        )
      )}
    </div>
  );
}
