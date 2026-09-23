import { Copy, Eye, History, MoreHorizontal, Save } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { VersionMeta, VersionSource } from '@shared/types/db';

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

/** What a row can do with its version; the list passes the same to every row. */
export interface VersionRowActions {
  /** Only the open template's versions can be read in the sheet. */
  canPreview: boolean;
  previewId: string | null;
  onPreview: (version: VersionMeta, label: string) => void;
  onRestore: (version: VersionMeta) => void;
  onDuplicate: (version: VersionMeta) => void;
}

interface VersionRowProps extends VersionRowActions {
  version: VersionMeta;
  isHead: boolean;
  /** Inside an open run: no dot of its own, a tick to the run's line instead. */
  isNested: boolean;
  label: string;
  time: string;
}

export function VersionRow({
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
