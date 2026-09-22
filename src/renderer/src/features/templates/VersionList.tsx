import { Copy, Eye, History, Save } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { cn } from '@/lib/utils';
import type { VersionMeta } from '@shared/types/db';
import { formatTimeInDay, groupVersionHistory } from './groupVersionHistory';
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
}

/**
 * One history, two layers: auto versions Mosaic takes on its own (import, restore) sit
 * quiet; named versions are the user's own bookmarks — bold, with the amber mark.
 */
export function VersionList({ versions, ...rowProps }: VersionListProps) {
  const groups = groupVersionHistory(versions);
  return (
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
            {group.items
              .flatMap((item) => (item.kind === 'run' ? item.versions : [item]))
              .map(({ version, index }) => (
                <VersionRow
                  key={version.id}
                  version={version}
                  isHead={index === 0}
                  label={versionLabel(versions, index)}
                  time={formatTimeInDay(version.createdAt)}
                  {...rowProps}
                />
              ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

interface VersionRowProps extends Omit<VersionListProps, 'versions'> {
  version: VersionMeta;
  isHead: boolean;
  label: string;
  time: string;
}

function VersionRow({
  version,
  isHead: head,
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
        'group relative flex items-start gap-2.5 py-1.5',
        previewing && 'rounded-sm bg-amber-soft ring-4 ring-amber-soft'
      )}
    >
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
