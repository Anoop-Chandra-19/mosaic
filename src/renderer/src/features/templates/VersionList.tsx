import { useRef, useState, type ReactNode } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  Eye,
  History,
  MoreHorizontal,
  Save,
} from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { VersionMeta, VersionSource } from '@shared/types/db';
import { chooseVisibleVersions } from './chooseVisibleVersions';
import {
  filterVersionHistory,
  isHistoryFiltered,
  listHistorySections,
  NO_HISTORY_FILTER,
} from './filterVersionHistory';
import {
  describeRunSections,
  formatHistoryMonth,
  formatTimeInDay,
  formatTimeOfDay,
  groupVersionHistory,
} from './groupVersionHistory';
import { HistoryFilterBar, type HistoryMonth } from './HistoryFilterBar';
import { versionLabel } from './useTemplateVersions';

interface VersionListProps {
  /** Newest first. */
  versions: VersionMeta[];
  /** Only the open template's versions can be read in the sheet. */
  canPreview: boolean;
  previewId: string | null;
  onPreview: (version: VersionMeta, label: string) => void;
  onRestore: (version: VersionMeta) => void;
  onDuplicate: (version: VersionMeta) => void;
  /**
   * A template that is not open: its newest dozen and no filter bar, so two sticky strips
   * never share the sidebar.
   */
  isCompact?: boolean;
  /** Until the full history view exists, the versions past the sidebar's are only counted. */
  onOpenFullHistory?: () => void;
}

/**
 * Tags only where the source is news. Named versions and plain edits need none: the dot
 * and the weight of the summary already say which they are.
 */
const SOURCE_TAGS: Partial<Record<VersionSource, string>> = {
  import: 'import',
  restore: 'restore',
  create: 'created',
  duplicate: 'copy',
  switched: 'left off',
  closed: 'left off',
};

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

interface HistoryCountProps {
  versions: VersionMeta[];
  isCompact: boolean;
  onOpenFullHistory?: () => void;
}

/** "2,041 versions · 12 named · since Oct 2025", once a history is long enough to need it. */
function HistoryCount({ versions, isCompact, onOpenFullHistory }: HistoryCountProps) {
  const namedCount = versions.filter((version) => version.kind === 'named').length;
  return (
    <p
      className={cn(
        'mb-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[0.7rem] text-ink-faint',
        isCompact ? 'mt-1.5' : 'mt-2.25'
      )}
    >
      <span>
        <b className="font-semibold text-ink-muted">{versions.length.toLocaleString()}</b> versions
      </span>
      <span aria-hidden>·</span>
      <span>
        <b className="font-semibold text-ink-muted">{namedCount.toLocaleString()}</b> named
      </span>
      <span aria-hidden>·</span>
      <span>since {formatHistoryMonth(versions.at(-1)!.createdAt)}</span>
      {onOpenFullHistory && (
        <>
          <span aria-hidden>·</span>
          <AppButton
            variant="link"
            onClick={onOpenFullHistory}
            className="h-auto p-0 font-mono text-[0.7rem] font-normal text-ink-muted underline underline-offset-2 hover:text-amber-600 dark:hover:text-amber-400"
          >
            full history
          </AppButton>
        </>
      )}
    </p>
  );
}

interface HistoryHandoffProps {
  label: string;
  hiddenCount: number;
  oldestMonth: string;
  isCompact: boolean;
  onOpenFullHistory?: () => void;
}

/** The one row that stands for every version the sidebar leaves out. */
function HistoryHandoff({
  label,
  hiddenCount,
  oldestMonth,
  isCompact,
  onOpenFullHistory,
}: HistoryHandoffProps) {
  const rest = `${hiddenCount.toLocaleString()} earlier ${hiddenCount === 1 ? 'version' : 'versions'}, back to ${oldestMonth}.`;
  if (!onOpenFullHistory) {
    // Nothing to hand off to yet, so a peek says where the rest can be read.
    return (
      <p className="mt-2.5 mb-0.5 ml-5.5 font-mono text-[0.675rem] text-ink-faint">
        {rest} {isCompact ? 'Open the template to see them.' : 'All kept.'}
      </p>
    );
  }
  return (
    <AppButton
      variant="dashed"
      size="xs"
      onClick={onOpenFullHistory}
      className={cn(
        'h-auto w-full flex-col items-start gap-0.5 rounded-sm border-line-strong px-2.5 py-2 text-ink-soft hover:border-line-heavy',
        isCompact ? 'mt-1.5' : 'mt-2'
      )}
    >
      <span className="flex items-center gap-1.5">
        <ExternalLink className="size-3" />
        {label}
      </span>
      <span className="font-mono text-[0.675rem] font-normal text-ink-faint">{rest} All kept.</span>
    </AppButton>
  );
}

interface RunRowProps {
  /** Newest first. */
  run: VersionMeta[];
  labelOf: (version: VersionMeta) => string;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}

/** A run of plain editing held as one row on a bead-stack dot; it opens in place. */
function RunRow({ run, labelOf, isOpen, onToggle, children }: RunRowProps) {
  const newest = run[0];
  const oldest = run.at(-1)!;
  const Chevron = isOpen ? ChevronDown : ChevronRight;
  return (
    <li>
      <AppButton
        variant="ghost"
        shape="text"
        aria-expanded={isOpen}
        onClick={onToggle}
        className="flex w-full items-start gap-2.5 px-0 py-1.25"
      >
        <span
          aria-hidden
          className="relative mt-1 ml-px size-2.75 shrink-0 rounded-full shadow-[inset_0_0_0_1.5px_var(--line-heavy)] before:absolute before:-top-1.25 before:left-0.5 before:h-0.5 before:w-1.5 before:rounded-full before:bg-line-heavy after:absolute after:-bottom-1.25 after:left-0.5 after:h-0.5 after:w-1.5 after:rounded-full after:bg-line-heavy"
        />
        <span className="min-w-0 flex-1">
          <span className="block text-[0.8rem] leading-[1.4] font-medium text-ink-soft">
            {run.length} snapshots while you worked
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[0.7rem] text-ink-faint">
            <span className="whitespace-nowrap">
              {formatTimeOfDay(oldest.createdAt)} to {formatTimeOfDay(newest.createdAt)}
            </span>
            <span className="whitespace-nowrap">
              {labelOf(oldest)} to {labelOf(newest)}
            </span>
            <span className="text-ink-muted">{describeRunSections(run)}</span>
          </span>
        </span>
        <span
          className={cn(
            'rounded-[0.3125rem] border px-1.25 py-px font-mono text-[0.65625rem] whitespace-nowrap',
            isOpen ? 'border-line-heavy text-ink-soft' : 'border-line-strong text-ink-muted'
          )}
        >
          {isOpen ? 'hide' : 'open'}
        </span>
        <Chevron aria-hidden className="mt-1 size-3 text-ink-faint" />
      </AppButton>
      {isOpen && <ol className="mt-px mb-1.5 ml-5.25 border-l border-line pl-3">{children}</ol>}
    </li>
  );
}

interface VersionRowProps extends Omit<
  VersionListProps,
  'versions' | 'isCompact' | 'onOpenFullHistory'
> {
  version: VersionMeta;
  isHead: boolean;
  /** Inside an open run: no dot of its own, a tick to the run's line instead. */
  isNested: boolean;
  label: string;
  time: string;
}

function VersionRow({
  version,
  isHead: head,
  isNested,
  label,
  time,
  canPreview,
  previewId,
  onPreview,
  onRestore,
  onDuplicate,
}: VersionRowProps) {
  const isNamed = version.kind === 'named';
  const isStop = version.source === 'switched' || version.source === 'closed';
  const tag = SOURCE_TAGS[version.source];
  const previewing = previewId === version.id;
  const previewHint = canPreview
    ? previewing
      ? 'Stop previewing and go back to your draft'
      : 'Read this version in the sheet. Nothing is changed.'
    : 'Open this template to preview its versions';
  return (
    <li
      className={cn(
        'group relative flex items-start gap-2.5 rounded-md hover:bg-pane',
        isNested
          ? 'py-0.75 before:absolute before:top-2.75 before:-left-3 before:h-px before:w-1.75 before:bg-line'
          : 'py-1.25',
        previewing && 'bg-amber-soft ring-4 ring-amber-soft hover:bg-amber-soft'
      )}
    >
      {!isNested && (
        <span
          aria-hidden
          className={cn(
            'relative z-1 shrink-0 rounded-full border-2 border-white dark:border-zinc-950',
            isNamed ? 'mt-[0.21875rem] size-3' : 'mt-1.25 ml-[0.09375rem] size-2.25',
            head
              ? 'bg-amber-500 ring-3 ring-amber-soft'
              : isNamed
                ? 'bg-ink-muted'
                : isStop
                  ? 'bg-ink-muted shadow-[0_0_0_1px_var(--line-heavy)]'
                  : version.source === 'edit'
                    ? 'bg-line-heavy'
                    : 'bg-ink-faint'
          )}
        />
      )}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'leading-[1.4]',
            isNested ? 'text-[0.775rem]' : 'text-[0.8rem]',
            isNamed ? 'font-semibold text-foreground' : 'text-ink-muted'
          )}
        >
          {isNamed && (
            <Save className="mr-1.25 inline size-2.5 align-baseline text-amber-600 dark:text-amber-400" />
          )}
          {version.summary}
        </p>
        <p className="mt-0.75 flex flex-wrap items-center gap-x-1.75 gap-y-1 font-mono text-[0.70625rem] text-ink-faint *:whitespace-nowrap">
          {tag && (
            <span
              className={cn(
                'inline-flex h-4 items-center rounded-[0.25rem] border px-1.25 font-sans text-[0.625rem] font-bold tracking-[0.04em] uppercase',
                version.source === 'restore'
                  ? 'border-info-line text-info'
                  : isStop
                    ? 'border-line-heavy text-ink-soft'
                    : 'border-line-strong text-ink-muted'
              )}
            >
              {tag}
            </span>
          )}
          <span>{label}</span>
          <span>{time}</span>
          {head && <span className="text-amber-600 dark:text-amber-400">current</span>}
        </p>
      </div>
      <span
        className={cn(
          'flex shrink-0 gap-0.5 @max-[18.75rem]/history:visible',
          !previewing && 'invisible group-focus-within:visible group-hover:visible'
        )}
      >
        {/* A narrow panel has no room for three buttons, so they fold into one menu. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <AppButton
              variant="ghost"
              size="xs"
              shape="square"
              aria-label={`Actions for ${label}`}
              className="hidden @max-[18.75rem]/history:inline-flex"
            >
              <MoreHorizontal className="size-3" />
            </AppButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem disabled={!canPreview} onClick={() => onPreview(version, label)}>
              <Eye />
              {previewing ? 'Stop reading it' : 'Read this version'}
            </DropdownMenuItem>
            {!head && (
              <DropdownMenuItem onClick={() => onRestore(version)}>
                <History />
                Restore
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onDuplicate(version)}>
              <Copy />
              Duplicate as a new template
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="flex gap-0.5 @max-[18.75rem]/history:hidden">
          <AppButton
            variant="ghost"
            size="xs"
            shape="square"
            disabled={!canPreview}
            aria-pressed={previewing}
            aria-label={`Preview ${label}`}
            title={previewHint}
            onClick={() => onPreview(version, label)}
            className={cn(previewing && 'bg-line-strong text-foreground')}
          >
            <Eye className="size-3" />
          </AppButton>
          {!head && (
            <AppButton
              variant="ghost"
              size="xs"
              shape="square"
              aria-label={`Restore ${label}`}
              title="Restore. What you have now is kept in history first."
              onClick={() => onRestore(version)}
            >
              <History className="size-3" />
            </AppButton>
          )}
          <AppButton
            variant="ghost"
            size="xs"
            shape="square"
            aria-label={`Duplicate ${label} as a new template`}
            title="Duplicate as a new template"
            onClick={() => onDuplicate(version)}
          >
            <Copy className="size-3" />
          </AppButton>
        </span>
      </span>
    </li>
  );
}
