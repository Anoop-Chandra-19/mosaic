import { Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VersionMeta, VersionSource } from '@shared/types/db';
import { useVersionPreviewComparison } from '../useVersionPreviewComparison';
import { VersionActions } from './VersionActions';
import { VersionDeleteConfirm } from './VersionDeleteConfirm';
import { VersionNameField, VersionNameKeys } from './VersionNameField';

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

function describePreviewDistance(placeCount: number, hasFormatting: boolean): string {
  if (placeCount > 0) return `differs in ${placeCount} ${placeCount === 1 ? 'place' : 'places'}`;
  return hasFormatting ? 'same words as your draft' : 'same as your draft';
}

/** How far the version being read in the sheet is from the draft. */
function PreviewDistance() {
  const comparison = useVersionPreviewComparison();
  if (!comparison) return null;
  return (
    <span title="Places where this version and your draft differ">
      {describePreviewDistance(comparison.diff.changes.length, comparison.formatting.length > 0)}
    </span>
  );
}

/** What a row can do with its version; the list's owner passes the same to every row. */
export interface VersionRowActions {
  /** Only the open template's versions can be read in the sheet. */
  canPreview: boolean;
  previewId: string | null;
  onPreview: (version: VersionMeta, label: string) => void;
  onRestore: (version: VersionMeta) => void;
  onDuplicate: (version: VersionMeta) => void;
}

/** A row open for naming, or asking before a named version is deleted. One at a time. */
export type VersionRowMode = 'name' | 'delete';

interface VersionRowProps extends VersionRowActions {
  version: VersionMeta;
  isHead: boolean;
  /** Inside an open run or fold: no dot of its own, a tick to its line instead. */
  isNested: boolean;
  /** In the full view, reading shows the version beside the list, not in the sheet. */
  isWide: boolean;
  label: string;
  time: string;
  mode: VersionRowMode | null;
  /** Named a moment ago: it washes amber once. */
  isJustNamed: boolean;
  onModeChange: (mode: VersionRowMode | null) => void;
  onName: (version: VersionMeta, name: string) => void;
  onDelete: (version: VersionMeta) => void;
  onSelect?: (version: VersionMeta) => void;
}

export function VersionRow({
  version,
  isHead,
  isNested,
  isWide,
  label,
  time,
  mode,
  isJustNamed,
  onModeChange,
  onName,
  onDelete,
  onSelect,
  canPreview,
  previewId,
  onPreview,
  onRestore,
  onDuplicate,
}: VersionRowProps) {
  const isNamed = version.kind === 'named';
  const isStop = version.source === 'switched' || version.source === 'closed';
  const tag = SOURCE_TAGS[version.source];
  const isPreviewing = previewId === version.id;
  const isConfirming = mode === 'delete';

  return (
    <li
      data-version-id={version.id}
      // A pointer shortcut for the Read button, which is what the keyboard reaches.
      onClick={
        onSelect &&
        ((event) => {
          if (!(event.target as Element).closest('button, input, [role="alertdialog"]')) {
            onSelect(version);
          }
        })
      }
      className={cn(
        'group relative flex items-start gap-2.5 rounded-md hover:bg-pane',
        onSelect && !mode && 'cursor-pointer',
        isNested
          ? 'py-0.75 before:absolute before:top-2.75 before:-left-3 before:h-px before:w-1.75 before:bg-line'
          : 'py-1.25',
        isPreviewing && 'bg-amber-soft ring-4 ring-amber-soft hover:bg-amber-soft',
        isConfirming &&
          'bg-del-soft pr-1.5 shadow-[inset_0_0_0_1px_var(--del-line)] hover:bg-del-soft',
        isJustNamed && 'animate-named-wash motion-reduce:animate-none'
      )}
    >
      {!isNested && (
        <span
          aria-hidden
          className={cn(
            'relative z-1 shrink-0 rounded-full border-2 border-white dark:border-zinc-950',
            isNamed ? 'mt-[0.21875rem] size-3' : 'mt-1.25 ml-[0.09375rem] size-2.25',
            isJustNamed && 'animate-marker-pop motion-reduce:animate-none',
            isConfirming
              ? 'bg-del'
              : isHead
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
      {isConfirming ? (
        <VersionDeleteConfirm
          version={version}
          label={label}
          onDelete={() => onDelete(version)}
          onKeep={() => onModeChange(null)}
        />
      ) : (
        <>
          <div className="min-w-0 flex-1">
            {mode === 'name' ? (
              <VersionNameField
                version={version}
                label={label}
                onCommit={(name) => onName(version, name)}
                onCancel={() => onModeChange(null)}
              />
            ) : (
              <p
                className={cn(
                  'leading-[1.4]',
                  isNested ? 'text-[0.775rem]' : 'text-[0.8rem]',
                  isNamed ? 'font-semibold text-foreground' : 'text-ink-muted'
                )}
              >
                {isNamed && (
                  <Save
                    className={cn(
                      'mr-1.25 inline size-2.5 align-baseline text-amber-600 dark:text-amber-400',
                      isJustNamed && 'animate-marker-pop motion-reduce:animate-none'
                    )}
                  />
                )}
                {version.summary}
              </p>
            )}
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
              {mode === 'name' ? <VersionNameKeys /> : <span>{time}</span>}
              {!mode && isHead && (
                <span className="text-amber-600 dark:text-amber-400">newest</span>
              )}
              {!mode && isPreviewing && !isWide && <PreviewDistance />}
            </p>
          </div>
          {!mode && (
            <VersionActions
              version={version}
              label={label}
              isHead={isHead}
              isNested={isNested}
              isWide={isWide}
              isPreviewing={isPreviewing}
              canPreview={canPreview}
              onPreview={() => onPreview(version, label)}
              onRestore={() => onRestore(version)}
              onDuplicate={() => onDuplicate(version)}
              onStartNaming={() => onModeChange('name')}
              onDelete={() => (isNamed ? onModeChange('delete') : onDelete(version))}
            />
          )}
        </>
      )}
    </li>
  );
}
