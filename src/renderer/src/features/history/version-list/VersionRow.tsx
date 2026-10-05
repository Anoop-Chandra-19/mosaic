import { Save } from 'lucide-react';
import { Text } from '@/components/Text';
import type { TextVariant } from '@/components/textVariants';
import { ChangeCounts } from '@/features/document-diff/ChangeCounts';
import { cn } from '@/lib/utils';
import type { ChangeTone } from '@shared/resume/changes/resumeChange';
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

/**
 * The row's mark on the rail. Each fills the same 12px slot, and only named versions are
 * nodes; the rest sit across the line, so it reads unbroken.
 */
type RailMark = 'tick' | 'newest' | 'named' | 'leftOff' | 'event';

function chooseRailMark(version: VersionMeta, isHead: boolean): RailMark {
  if (version.kind === 'named') return 'named';
  if (isHead) return 'newest';
  if (version.source === 'switched' || version.source === 'closed') return 'leftOff';
  return version.source === 'edit' ? 'tick' : 'event';
}

const RAIL_MARKS: Record<RailMark, string> = {
  tick: 'mx-[0.09375rem] mt-[0.5625rem] h-px w-[0.5625rem] rounded-[0.0625rem] bg-ink-muted',
  newest: 'mx-[0.03125rem] mt-2 h-[0.1875rem] w-[0.6875rem] rounded-[0.0625rem] bg-ink-soft',
  named:
    'mx-[0.109375rem] mt-[0.328125rem] size-[0.53125rem] rotate-45 rounded-[0.09375rem] bg-foreground shadow-[0_0_0_2.5px_var(--background)]',
  leftOff:
    'mx-[0.15625rem] mt-1.5 size-[0.4375rem] rounded-[0.09375rem] bg-ink-muted shadow-[0_0_0_2px_var(--background)]',
  event:
    'mx-[0.15625rem] mt-1.5 size-[0.4375rem] rounded-[0.09375rem] bg-background shadow-[inset_0_0_0_1.5px_var(--ink-faint),0_0_0_2px_var(--background)]',
};

/** Amber is only ever the version being read. */
const SELECTED_RAIL_MARKS: Record<RailMark, string> = {
  tick: 'bg-amber',
  newest: 'bg-amber',
  named: 'shadow-[0_0_0_2px_var(--background),0_0_0_3.5px_var(--amber)]',
  leftOff: 'bg-background shadow-[inset_0_0_0_1.5px_var(--amber),0_0_0_2px_var(--background)]',
  event: 'shadow-[inset_0_0_0_1.5px_var(--amber),0_0_0_2px_var(--background)]',
};

function railMarkClasses(
  mark: RailMark,
  isHead: boolean,
  isSelected: boolean,
  isConfirming: boolean
) {
  if (isConfirming) return cn(RAIL_MARKS[mark], 'bg-del shadow-[0_0_0_2.5px_var(--del-soft)]');
  if (isSelected) return cn(RAIL_MARKS[mark], SELECTED_RAIL_MARKS[mark]);
  return cn(
    RAIL_MARKS[mark],
    mark === 'named' &&
      isHead &&
      'shadow-[0_0_0_2px_var(--background),0_0_0_3.25px_var(--ink-muted)]'
  );
}

/** A named version's summary carries the row; a row inside a run is a step smaller. */
function summaryVariant(isNamed: boolean, isNested: boolean): TextVariant {
  if (isNamed) return 'strong';
  return isNested ? 'secondary' : 'body';
}

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
  /** The full view's selected row, with all details on: what it changed from the one before. */
  counts?: Record<ChangeTone, number> | null;
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
  counts,
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
        'group relative flex items-start gap-2.5 rounded-md hover:bg-row-hover',
        onSelect && !mode && 'cursor-pointer',
        // A nested row's tick crosses its run's line, as the marks cross the rail.
        isNested
          ? 'py-[0.21875rem] before:absolute before:top-3 before:-left-4 before:h-px before:w-1.75 before:bg-ink-faint'
          : // Tints start left of the slot, so a row's box never cuts its mark.
            '-ml-1.5 py-1.25 pl-1.5',
        isPreviewing &&
          (isWide
            ? 'bg-amber-wash shadow-[inset_0_0_0_1px_var(--amber-line)] hover:bg-amber-wash'
            : 'bg-amber-wash ring-4 ring-amber-wash hover:bg-amber-wash'),
        isConfirming &&
          'bg-del-soft pr-1.5 shadow-[inset_0_0_0_1px_var(--del-line)] hover:bg-del-soft',
        isJustNamed && 'animate-named-wash motion-reduce:animate-none'
      )}
    >
      {!isNested && (
        <span
          aria-hidden
          className={cn(
            // The rail is 1px on a whole pixel, centred at 5.5px; the slot's centre is 6px.
            'relative z-1 shrink-0 -translate-x-[0.03125rem]',
            railMarkClasses(chooseRailMark(version, isHead), isHead, isPreviewing, isConfirming),
            isJustNamed && 'animate-marker-pop motion-reduce:animate-none'
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
              <Text
                as="p"
                variant={summaryVariant(isNamed, isNested)}
                className={cn(!isNamed && 'text-ink-muted')}
              >
                {isNamed && (
                  <Save
                    className={cn(
                      'mr-1.25 inline size-2.5 align-baseline text-amber',
                      isJustNamed && 'animate-marker-pop motion-reduce:animate-none'
                    )}
                  />
                )}
                {version.summary}
              </Text>
            )}
            <Text
              as="p"
              variant="meta"
              className="mt-0.75 flex flex-wrap items-center gap-x-1.75 gap-y-1 *:whitespace-nowrap"
            >
              {tag && (
                <Text
                  variant="tag"
                  className={cn(
                    'inline-flex h-4 items-center rounded-[0.25rem] border px-1.25',
                    version.source === 'restore'
                      ? 'border-info-line text-info'
                      : isStop
                        ? 'border-line-heavy text-ink-soft'
                        : 'border-line-strong text-ink-muted'
                  )}
                >
                  {tag}
                </Text>
              )}
              <span>{label}</span>
              {mode === 'name' ? <VersionNameKeys /> : <span>{time}</span>}
              {!mode && isHead && <span className="text-amber">newest</span>}
              {!mode && isPreviewing && !isWide && <PreviewDistance />}
              {!mode && counts && <ChangeCounts counts={counts} />}
            </Text>
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
