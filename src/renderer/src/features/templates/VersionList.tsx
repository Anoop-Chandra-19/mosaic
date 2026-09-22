import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, Copy, ExternalLink, Eye, History, Save } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { cn } from '@/lib/utils';
import type { VersionMeta } from '@shared/types/db';
import { chooseVisibleVersions } from './chooseVisibleVersions';
import {
  describeRunSections,
  formatHistoryMonth,
  formatTimeInDay,
  formatTimeOfDay,
  groupVersionHistory,
  type IndexedVersion,
} from './groupVersionHistory';
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
export function VersionList({ versions, onOpenFullHistory, ...rowProps }: VersionListProps) {
  const { shown, hiddenCount } = chooseVisibleVersions(versions, { total: versions.length });
  const groups = groupVersionHistory(shown);
  const oldestMonth = formatHistoryMonth(versions.at(-1)!.createdAt);
  // Keyed by a run's oldest version, which stays the same as newer edits join the run.
  const [openRuns, setOpenRuns] = useState<ReadonlySet<string>>(new Set());
  const toggleRun = (key: string) =>
    setOpenRuns((open) => {
      const next = new Set(open);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  const renderRow = ({ version, index }: IndexedVersion, isNested = false) => (
    <VersionRow
      key={version.id}
      version={version}
      isHead={index === 0}
      isNested={isNested}
      label={versionLabel(versions, index)}
      time={formatTimeInDay(version.createdAt)}
      {...rowProps}
    />
  );
  return (
    <>
      {versions.length > SHORT_HISTORY && (
        <HistoryCount versions={versions} onOpenFullHistory={onOpenFullHistory} />
      )}
      <div className="relative mt-1.5">
        <span
          aria-hidden
          className="absolute top-2 bottom-2.5 left-[0.34rem] w-px bg-zinc-300 dark:bg-zinc-700"
        />
        {groups.map((group) => (
          <section key={group.key} aria-label={group.label}>
            <h4
              className={cn(
                'sticky top-0 z-3 flex items-center gap-2 bg-white pt-2.75 pb-1.25 pl-5.5 text-[0.65625rem] font-semibold tracking-[0.08em] uppercase dark:bg-zinc-950',
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
                if (item.kind === 'version') return renderRow(item);
                const key = item.versions.at(-1)!.version.id;
                return (
                  <RunRow
                    key={key}
                    run={item.versions}
                    versions={versions}
                    isOpen={openRuns.has(key)}
                    onToggle={() => toggleRun(key)}
                  >
                    {item.versions.map((entry) => renderRow(entry, true))}
                  </RunRow>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
      {hiddenCount > 0 ? (
        <HistoryHandoff
          hiddenCount={hiddenCount}
          oldestMonth={oldestMonth}
          onOpenFullHistory={onOpenFullHistory}
        />
      ) : (
        shown.length > END_LINE_ROWS && (
          <p className="mt-2.5 mb-0.5 ml-5.5 font-mono text-[0.675rem] text-ink-faint">
            That is all {shown.length.toLocaleString()} of them, back to {oldestMonth}.
          </p>
        )
      )}
    </>
  );
}

interface HistoryCountProps {
  versions: VersionMeta[];
  onOpenFullHistory?: () => void;
}

/** "2,041 versions · 12 named · since Oct 2025", once a history is long enough to need it. */
function HistoryCount({ versions, onOpenFullHistory }: HistoryCountProps) {
  const namedCount = versions.filter((version) => version.kind === 'named').length;
  return (
    <p className="mt-2.25 mb-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[0.7rem] text-ink-faint">
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
  hiddenCount: number;
  oldestMonth: string;
  onOpenFullHistory?: () => void;
}

/** The one row that stands for every version the sidebar leaves out. */
function HistoryHandoff({ hiddenCount, oldestMonth, onOpenFullHistory }: HistoryHandoffProps) {
  const rest = `${hiddenCount.toLocaleString()} earlier ${hiddenCount === 1 ? 'version' : 'versions'}, back to ${oldestMonth}. All kept.`;
  if (!onOpenFullHistory) {
    return <p className="mt-2.5 mb-0.5 ml-5.5 font-mono text-[0.675rem] text-ink-faint">{rest}</p>;
  }
  return (
    <AppButton
      variant="dashed"
      size="xs"
      onClick={onOpenFullHistory}
      className="mt-2 h-auto w-full flex-col items-start gap-0.5 rounded-sm border-line-strong px-2.5 py-2 text-ink-soft hover:border-line-heavy"
    >
      <span className="flex items-center gap-1.5">
        <ExternalLink className="size-3" />
        Open the full history
      </span>
      <span className="font-mono text-[0.675rem] font-normal text-ink-faint">{rest}</span>
    </AppButton>
  );
}

interface RunRowProps {
  /** Newest first, with each version's place in the whole history. */
  run: IndexedVersion[];
  versions: VersionMeta[];
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}

/** A run of plain editing held as one row on a bead-stack dot; it opens in place. */
function RunRow({ run, versions, isOpen, onToggle, children }: RunRowProps) {
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
          <span className="block text-xs leading-snug font-medium text-ink-soft">
            {run.length} snapshots while you worked
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[0.7rem] text-ink-faint">
            <span className="whitespace-nowrap">
              {formatTimeOfDay(oldest.version.createdAt)} to{' '}
              {formatTimeOfDay(newest.version.createdAt)}
            </span>
            <span className="whitespace-nowrap">
              {versionLabel(versions, oldest.index)} to {versionLabel(versions, newest.index)}
            </span>
            <span className="text-ink-muted">
              {describeRunSections(run.map((entry) => entry.version))}
            </span>
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

interface VersionRowProps extends Omit<VersionListProps, 'versions' | 'onOpenFullHistory'> {
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
  const auto = version.kind === 'auto';
  const previewing = previewId === version.id;
  return (
    <li
      className={cn(
        'group relative flex items-start gap-2.5',
        isNested
          ? 'py-0.75 before:absolute before:top-2.75 before:-left-3 before:h-px before:w-1.75 before:bg-line'
          : 'py-1.5',
        previewing && 'rounded-sm bg-amber-soft ring-4 ring-amber-soft'
      )}
    >
      {!isNested && (
        <span
          aria-hidden
          className={cn(
            'relative mt-0.5 size-3 shrink-0 rounded-full border-2 border-white dark:border-zinc-950',
            head
              ? 'bg-amber-500 ring-3 ring-amber-soft'
              : auto
                ? 'bg-zinc-300 dark:bg-zinc-700'
                : 'bg-zinc-500'
          )}
        />
      )}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'text-xs leading-snug',
            auto
              ? 'text-zinc-600 dark:text-zinc-400'
              : 'font-semibold text-zinc-900 dark:text-zinc-100'
          )}
        >
          {!auto && (
            <Save className="mr-1 inline size-2.5 align-baseline text-amber-600 dark:text-amber-400" />
          )}
          {version.summary}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[0.7rem] text-zinc-500">
          <span
            className={cn(
              'rounded border px-1 font-sans text-[0.6rem] font-bold tracking-wide uppercase',
              auto
                ? 'border-zinc-300 text-zinc-500 dark:border-zinc-700'
                : 'border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-400'
            )}
          >
            {auto ? 'auto' : 'named'}
          </span>
          <span>{label}</span>
          <span>{time}</span>
          {head && <span className="text-amber-600 dark:text-amber-400">current</span>}
        </p>
      </div>
      <span
        className={cn(
          'flex shrink-0 gap-0.5',
          !previewing && 'invisible group-focus-within:visible group-hover:visible'
        )}
      >
        <AppButton
          variant="ghost"
          size="xs"
          shape="square"
          disabled={!canPreview}
          aria-pressed={previewing}
          aria-label={`Preview ${label}`}
          title={
            canPreview
              ? previewing
                ? 'Stop previewing and go back to your draft'
                : 'Read this version in the sheet. Nothing is changed.'
              : 'Open this template to preview its versions'
          }
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
    </li>
  );
}
